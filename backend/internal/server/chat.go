package server

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/guts-yang/hello-gutsyang/backend/internal/ai"
	"github.com/guts-yang/hello-gutsyang/backend/internal/model"
)

// chatOwnerKey is the unexported context key used to thread the anon chat
// owner UUID from the middleware down into per-route handlers.
type chatOwnerKey struct{}

// withChatOwner reads the anon chat owner cookie (or mints one and writes it
// back via Set-Cookie when missing) and stores the resulting UUID in the
// request context. This is scoped to /v1/ai/* so the rest of the API does not
// pay for a cookie roundtrip. The cookie is HttpOnly + SameSite=Lax: the
// visitor never needs to read it from JS, and Lax lets us round-trip across
// the Next.js proxy without being rejected like Strict would.
func (s *Server) withChatOwner(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.URL.Path, "/v1/ai/") {
			next.ServeHTTP(w, r)
			return
		}

		var owner uuid.UUID
		if cookie, err := r.Cookie(s.cfg.ChatOwnerCookie); err == nil && cookie.Value != "" {
			if parsed, parseErr := uuid.Parse(cookie.Value); parseErr == nil {
				owner = parsed
			}
		}
		if owner == uuid.Nil {
			owner = uuid.New()
			http.SetCookie(w, s.buildChatOwnerCookie(owner.String()))
		}

		ctx := context.WithValue(r.Context(), chatOwnerKey{}, owner)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// chatOwnerFromContext extracts the UUID stashed by withChatOwner. Routes
// outside /v1/ai/* should never call this -- they will get uuid.Nil back.
func chatOwnerFromContext(ctx context.Context) uuid.UUID {
	if v, ok := ctx.Value(chatOwnerKey{}).(uuid.UUID); ok {
		return v
	}
	return uuid.Nil
}

// buildChatOwnerCookie centralises cookie attributes for the anon owner cookie.
// MaxAge is one year so casual visitors keep their history between visits;
// power users can clear cookies to reset.
func (s *Server) buildChatOwnerCookie(value string) *http.Cookie {
	return &http.Cookie{
		Name:     s.cfg.ChatOwnerCookie,
		Value:    value,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   s.cfg.CookieSecure.Resolve(s.cfg.AppOrigin),
		MaxAge:   365 * 24 * 60 * 60,
	}
}

// handleChat is the streaming SSE endpoint. The body shape mirrors the
// previous implementation but now also accepts an optional sessionId; the
// handler ensures the session exists (creating one with a derived title when
// omitted), records the user turn, streams the assistant turn back, and on a
// clean stream end appends the assistant message to the transcript so the
// sidebar can replay it later.
func (s *Server) handleChat(w http.ResponseWriter, r *http.Request) {
	if !s.allowOrLimit(w, s.chatLimiter, clientIP(r), s.cfg.RateLimitChat.Window) {
		return
	}
	owner := chatOwnerFromContext(r.Context())
	if owner == uuid.Nil {
		writeServerError(w, r, errors.New("chat: missing owner in context"))
		return
	}

	var body struct {
		Locale    string       `json:"locale"`
		SessionID string       `json:"sessionId"`
		Messages  []ai.Message `json:"messages"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64*1024)).Decode(&body); err != nil {
		writeClientError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if len(body.Messages) == 0 {
		writeClientError(w, http.StatusBadRequest, "messages cannot be empty")
		return
	}

	locale := model.LocaleZH
	if body.Locale == "en" {
		locale = model.LocaleEN
	}

	// Resolve session (existing or new) before kicking off the upstream
	// stream. If the visitor sent a sessionId we honour it; otherwise we
	// derive a sidebar-friendly title from the latest user message.
	var (
		sessionUUID uuid.UUID
		err         error
	)
	if body.SessionID != "" {
		sessionUUID, err = uuid.Parse(body.SessionID)
		if err != nil {
			writeClientError(w, http.StatusBadRequest, "invalid session id")
			return
		}
	}
	latestUser := lastUserContent(body.Messages)
	title := ai.SummarizeTitle(latestUser)
	session, err := s.chatRepo.EnsureSession(r.Context(), owner, sessionUUID, title, string(locale))
	if err != nil {
		if errors.Is(err, ai.ErrSessionNotFound) {
			writeClientError(w, http.StatusNotFound, "session not found")
			return
		}
		writeServerError(w, r, err)
		return
	}

	if latestUser != "" {
		if err := s.chatRepo.AppendMessage(r.Context(), session.ID, "user", latestUser); err != nil {
			log.Printf("[err] chat: append user message: %v", err)
		}
	}

	upstream, err := s.ai.Stream(r.Context(), locale, body.Messages)
	if err != nil {
		writeServerError(w, r, err)
		return
	}
	defer upstream.Body.Close()

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Chat-Session-Id", session.ID.String())
	w.Header().Set("Access-Control-Expose-Headers", "X-Chat-Session-Id")

	if upstream.StatusCode >= 400 {
		payload, _ := io.ReadAll(io.LimitReader(upstream.Body, 2048))
		log.Printf("[err] AI upstream %d: %s", upstream.StatusCode, string(payload))
		http.Error(w, "upstream error", http.StatusBadGateway)
		return
	}

	if s.ai.DemoMode() {
		// Demo mode returns a pre-baked plain-text string. Copy it through
		// and store the same text as the assistant turn so the sidebar still
		// learns what was said.
		var demo strings.Builder
		mw := io.MultiWriter(w, &demo)
		_, _ = io.Copy(mw, upstream.Body)
		if demo.Len() > 0 {
			if err := s.chatRepo.AppendMessage(r.Context(), session.ID, "assistant", demo.String()); err != nil {
				log.Printf("[err] chat: append assistant (demo): %v", err)
			}
		}
		return
	}

	var assistant strings.Builder
	reader := upstream.Body
	buf := make([]byte, 4096)
	var pending strings.Builder
	flusher, _ := w.(http.Flusher)
	ctx := r.Context()

	persistAssistant := func() {
		text := assistant.String()
		if text == "" {
			return
		}
		// Use a detached context so a client disconnect mid-stream does not
		// abort the final transcript insert.
		persistCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := s.chatRepo.AppendMessage(persistCtx, session.ID, "assistant", text); err != nil {
			log.Printf("[err] chat: append assistant: %v", err)
		}
	}

	for {
		select {
		case <-ctx.Done():
			persistAssistant()
			return
		default:
		}

		n, err := reader.Read(buf)
		if n > 0 {
			pending.Write(buf[:n])
			for {
				chunk := pending.String()
				idx := strings.Index(chunk, "\n\n")
				if idx < 0 {
					break
				}
				event := strings.TrimSpace(chunk[:idx])
				rest := chunk[idx+2:]
				pending.Reset()
				pending.WriteString(rest)

				for _, line := range strings.Split(event, "\n") {
					if !strings.HasPrefix(line, "data:") {
						continue
					}
					payload := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
					if payload == "[DONE]" {
						persistAssistant()
						return
					}
					var decoded struct {
						Choices []struct {
							Delta struct {
								Content string `json:"content"`
							} `json:"delta"`
						} `json:"choices"`
					}
					if json.Unmarshal([]byte(payload), &decoded) == nil && len(decoded.Choices) > 0 {
						if delta := decoded.Choices[0].Delta.Content; delta != "" {
							assistant.WriteString(delta)
							_, _ = io.WriteString(w, delta)
							if flusher != nil {
								flusher.Flush()
							}
						}
					}
				}
			}
		}
		if err != nil {
			if !errors.Is(err, io.EOF) {
				log.Printf("[err] AI stream read: %v", err)
			}
			persistAssistant()
			return
		}
	}
}

// handleChatSessionsList returns the visitor's saved conversations newest
// first. The list endpoint shares the AI list rate limiter so a script cannot
// hammer the sidebar refresh.
func (s *Server) handleChatSessionsList(w http.ResponseWriter, r *http.Request) {
	if !s.allowOrLimit(w, s.chatListLimiter, clientIP(r), s.cfg.RateLimitAIList.Window) {
		return
	}
	owner := chatOwnerFromContext(r.Context())
	if owner == uuid.Nil {
		writeServerError(w, r, errors.New("chat: missing owner in context"))
		return
	}
	rows, err := s.chatRepo.ListSessions(r.Context(), owner)
	if err != nil {
		writeServerError(w, r, err)
		return
	}
	out := make([]model.ChatSessionItem, 0, len(rows))
	for _, s := range rows {
		out = append(out, model.ChatSessionItem{
			ID:        s.ID.String(),
			Title:     s.Title,
			Locale:    s.Locale,
			CreatedAt: s.CreatedAt,
			UpdatedAt: s.UpdatedAt,
		})
	}
	writeJSON(w, http.StatusOK, out)
}

// handleChatSessionMessages returns the transcript for a session the visitor
// owns. Foreign sessions yield 404 to avoid leaking existence.
func (s *Server) handleChatSessionMessages(w http.ResponseWriter, r *http.Request) {
	if !s.allowOrLimit(w, s.chatListLimiter, clientIP(r), s.cfg.RateLimitAIList.Window) {
		return
	}
	owner := chatOwnerFromContext(r.Context())
	if owner == uuid.Nil {
		writeServerError(w, r, errors.New("chat: missing owner in context"))
		return
	}
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeClientError(w, http.StatusBadRequest, "invalid session id")
		return
	}
	rows, err := s.chatRepo.GetMessages(r.Context(), owner, id)
	if err != nil {
		if errors.Is(err, ai.ErrSessionNotFound) {
			writeClientError(w, http.StatusNotFound, "session not found")
			return
		}
		writeServerError(w, r, err)
		return
	}
	out := make([]model.ChatMessageItem, 0, len(rows))
	for _, m := range rows {
		out = append(out, model.ChatMessageItem{
			ID:        m.ID.String(),
			Role:      m.Role,
			Content:   m.Content,
			CreatedAt: m.CreatedAt,
		})
	}
	writeJSON(w, http.StatusOK, out)
}

// handleChatSessionDelete removes a conversation owned by the visitor. Same
// 404 cloak as the messages endpoint for foreign ids.
func (s *Server) handleChatSessionDelete(w http.ResponseWriter, r *http.Request) {
	if !s.allowOrLimit(w, s.chatListLimiter, clientIP(r), s.cfg.RateLimitAIList.Window) {
		return
	}
	owner := chatOwnerFromContext(r.Context())
	if owner == uuid.Nil {
		writeServerError(w, r, errors.New("chat: missing owner in context"))
		return
	}
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeClientError(w, http.StatusBadRequest, "invalid session id")
		return
	}
	if err := s.chatRepo.DeleteSession(r.Context(), owner, id); err != nil {
		if errors.Is(err, ai.ErrSessionNotFound) {
			writeClientError(w, http.StatusNotFound, "session not found")
			return
		}
		writeServerError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// lastUserContent walks the message list backwards to find the most recent
// user-authored content. We persist that turn (not the assistant context) so
// the session title and resume-from-history both reflect the prompt that
// triggered the response.
func lastUserContent(messages []ai.Message) string {
	for i := len(messages) - 1; i >= 0; i-- {
		if messages[i].Role == "user" {
			return strings.TrimSpace(messages[i].Content)
		}
	}
	return ""
}
