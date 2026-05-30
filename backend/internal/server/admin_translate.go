package server

import (
	"encoding/json"
	"net/http"
	"sort"
	"strings"

	"github.com/guts-yang/hello-gutsyang/backend/internal/audit"
)

// handleAdminTranslate accepts a map of {field-key -> chinese text} and
// returns the same shape with each value translated to English by DeepSeek.
// The endpoint is admin-only (requireAdmin), CSRF-protected by the generic
// /v1/admin/* middleware, and rate-limited via a dedicated bucket so a
// runaway script cannot drain DeepSeek credits.
//
// We deliberately accept ONE flat map (no nested structures) so the API
// stays stable while the frontend evolves the set of translated fields:
// the admin form keys (e.g. "title", "summary", "highlights.0") are
// opaque to this layer.
func (s *Server) handleAdminTranslate(w http.ResponseWriter, r *http.Request) {
	if !s.allowOrLimit(w, s.adminAILimiter, clientIP(r), s.cfg.RateLimitAdminAI.Window) {
		return
	}
	session, ok := s.requireAdmin(w, r)
	if !ok {
		return
	}

	var body struct {
		Items map[string]string `json:"items"`
	}
	// Cap to 32 KiB -- four admin forms with verbose bios fit well under
	// this; a runaway client gets a clean 413.
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 32*1024)).Decode(&body); err != nil {
		writeClientError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if len(body.Items) == 0 {
		writeJSON(w, http.StatusOK, map[string]any{"items": map[string]string{}})
		return
	}
	// 64 fields is enough to cover the biggest form (project with a long
	// highlights list) and still fast for DeepSeek. Anything larger is
	// almost certainly a mistake.
	if len(body.Items) > 64 {
		writeClientError(w, http.StatusBadRequest, "too many items (max 64)")
		return
	}

	translated, err := s.ai.Translate(r.Context(), body.Items)
	if err != nil {
		writeServerError(w, r, err)
		return
	}

	// Record an audit row so password-rotation / suspicious-usage reviews
	// can spot which actor invoked the translator and against which fields.
	// We list the keys (no values) to keep audit storage small and avoid
	// duplicating the actual content into a second store.
	keys := make([]string, 0, len(body.Items))
	for k := range body.Items {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	uid := session.User
	_ = uid
	s.audit.Record(r.Context(), audit.Entry{
		Action:    "ai.translate",
		Target:    strings.Join(keys, ","),
		IP:        clientIP(r),
		UserAgent: r.UserAgent(),
		Meta:      map[string]any{"actor": session.User.Email, "count": len(body.Items)},
	})

	writeJSON(w, http.StatusOK, map[string]any{"items": translated})
}
