package ai

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrSessionNotFound is returned when a session is missing or does not belong
// to the caller's anon owner. Callers map this to 404 so the response does not
// leak whether a foreign session exists.
var ErrSessionNotFound = errors.New("chat: session not found")

// Session is one entry in the visitor's "history" sidebar.
type Session struct {
	ID        uuid.UUID
	OwnerID   uuid.UUID
	Title     string
	Locale    string
	CreatedAt time.Time
	UpdatedAt time.Time
}

// StoredMessage is a single message in a session transcript.
type StoredMessage struct {
	ID        uuid.UUID
	SessionID uuid.UUID
	Role      string
	Content   string
	CreatedAt time.Time
}

// SessionRepo is the persistence boundary for visitor chat sessions. Memory
// and pg implementations live below; the HTTP layer never references either
// concretely so the dev fallback (no DATABASE_URL) keeps working.
type SessionRepo interface {
	// EnsureSession creates a session for the owner when sessionID is the zero
	// UUID; otherwise it loads the existing one, verifying owner_id matches.
	// `title` is only consulted on creation; for an existing session the
	// stored title is preserved.
	EnsureSession(ctx context.Context, ownerID, sessionID uuid.UUID, title, locale string) (Session, error)

	// Touch updates updated_at to now() so the sidebar shows the freshest
	// conversation first. Best-effort; callers swallow errors.
	Touch(ctx context.Context, sessionID uuid.UUID) error

	// AppendMessage inserts one transcript row. role is "user" or "assistant".
	AppendMessage(ctx context.Context, sessionID uuid.UUID, role, content string) error

	// ListSessions returns the owner's sessions newest-updated first.
	ListSessions(ctx context.Context, ownerID uuid.UUID) ([]Session, error)

	// GetMessages returns the messages for a session, oldest first. Returns
	// ErrSessionNotFound when sessionID does not belong to ownerID.
	GetMessages(ctx context.Context, ownerID, sessionID uuid.UUID) ([]StoredMessage, error)

	// DeleteSession removes the session and its messages. Returns
	// ErrSessionNotFound when sessionID does not belong to ownerID.
	DeleteSession(ctx context.Context, ownerID, sessionID uuid.UUID) error
}

// SummarizeTitle builds a session title from the first user message. We trim
// whitespace, collapse newlines, and cap the visible width so the sidebar
// stays tidy even for stream-of-consciousness prompts.
func SummarizeTitle(raw string) string {
	cleaned := []rune{}
	prevSpace := false
	for _, r := range raw {
		if r == '\n' || r == '\r' || r == '\t' {
			r = ' '
		}
		if r == ' ' {
			if prevSpace {
				continue
			}
			prevSpace = true
		} else {
			prevSpace = false
		}
		cleaned = append(cleaned, r)
	}
	out := string(cleaned)
	// Trim leading/trailing single space that may remain.
	for len(out) > 0 && out[0] == ' ' {
		out = out[1:]
	}
	for len(out) > 0 && out[len(out)-1] == ' ' {
		out = out[:len(out)-1]
	}
	const maxRunes = 30
	r := []rune(out)
	if len(r) > maxRunes {
		out = string(r[:maxRunes]) + "…"
	}
	if out == "" {
		out = "New chat"
	}
	return out
}

// ---- memory implementation ----

type memorySessionRepo struct {
	mu       sync.RWMutex
	sessions map[uuid.UUID]Session
	messages map[uuid.UUID][]StoredMessage
}

// NewMemorySessionRepo builds an in-process SessionRepo used when the server
// runs without DATABASE_URL. It loses all data on restart -- intentional, since
// the persistent path is meant to be Postgres.
func NewMemorySessionRepo() SessionRepo {
	return &memorySessionRepo{
		sessions: make(map[uuid.UUID]Session),
		messages: make(map[uuid.UUID][]StoredMessage),
	}
}

func (r *memorySessionRepo) EnsureSession(_ context.Context, ownerID, sessionID uuid.UUID, title, locale string) (Session, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if sessionID != uuid.Nil {
		s, ok := r.sessions[sessionID]
		if !ok || s.OwnerID != ownerID {
			return Session{}, ErrSessionNotFound
		}
		return s, nil
	}
	now := time.Now().UTC()
	s := Session{
		ID:        uuid.New(),
		OwnerID:   ownerID,
		Title:     title,
		Locale:    locale,
		CreatedAt: now,
		UpdatedAt: now,
	}
	r.sessions[s.ID] = s
	return s, nil
}

func (r *memorySessionRepo) Touch(_ context.Context, sessionID uuid.UUID) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if s, ok := r.sessions[sessionID]; ok {
		s.UpdatedAt = time.Now().UTC()
		r.sessions[sessionID] = s
	}
	return nil
}

func (r *memorySessionRepo) AppendMessage(_ context.Context, sessionID uuid.UUID, role, content string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.sessions[sessionID]; !ok {
		return ErrSessionNotFound
	}
	r.messages[sessionID] = append(r.messages[sessionID], StoredMessage{
		ID:        uuid.New(),
		SessionID: sessionID,
		Role:      role,
		Content:   content,
		CreatedAt: time.Now().UTC(),
	})
	if s, ok := r.sessions[sessionID]; ok {
		s.UpdatedAt = time.Now().UTC()
		r.sessions[sessionID] = s
	}
	return nil
}

func (r *memorySessionRepo) ListSessions(_ context.Context, ownerID uuid.UUID) ([]Session, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]Session, 0)
	for _, s := range r.sessions {
		if s.OwnerID == ownerID {
			out = append(out, s)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].UpdatedAt.After(out[j].UpdatedAt) })
	return out, nil
}

func (r *memorySessionRepo) GetMessages(_ context.Context, ownerID, sessionID uuid.UUID) ([]StoredMessage, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	s, ok := r.sessions[sessionID]
	if !ok || s.OwnerID != ownerID {
		return nil, ErrSessionNotFound
	}
	src := r.messages[sessionID]
	out := make([]StoredMessage, len(src))
	copy(out, src)
	return out, nil
}

func (r *memorySessionRepo) DeleteSession(_ context.Context, ownerID, sessionID uuid.UUID) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	s, ok := r.sessions[sessionID]
	if !ok || s.OwnerID != ownerID {
		return ErrSessionNotFound
	}
	delete(r.sessions, sessionID)
	delete(r.messages, sessionID)
	return nil
}

// ---- pg implementation ----

type pgSessionRepo struct {
	pool *pgxpool.Pool
}

// NewPGSessionRepo builds a postgres-backed SessionRepo over the given pool.
func NewPGSessionRepo(pool *pgxpool.Pool) SessionRepo { return &pgSessionRepo{pool: pool} }

func (r *pgSessionRepo) EnsureSession(ctx context.Context, ownerID, sessionID uuid.UUID, title, locale string) (Session, error) {
	if sessionID != uuid.Nil {
		var s Session
		err := r.pool.QueryRow(ctx, `
			select id, owner_id, title, locale, created_at, updated_at
			from chat_sessions
			where id = $1 and owner_id = $2
		`, sessionID, ownerID).Scan(&s.ID, &s.OwnerID, &s.Title, &s.Locale, &s.CreatedAt, &s.UpdatedAt)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return Session{}, ErrSessionNotFound
			}
			return Session{}, fmt.Errorf("chat: pg load: %w", err)
		}
		return s, nil
	}
	id := uuid.New()
	now := time.Now().UTC()
	_, err := r.pool.Exec(ctx, `
		insert into chat_sessions (id, owner_id, title, locale, created_at, updated_at)
		values ($1, $2, $3, $4, $5, $5)
	`, id, ownerID, title, locale, now)
	if err != nil {
		return Session{}, fmt.Errorf("chat: pg insert session: %w", err)
	}
	return Session{
		ID:        id,
		OwnerID:   ownerID,
		Title:     title,
		Locale:    locale,
		CreatedAt: now,
		UpdatedAt: now,
	}, nil
}

func (r *pgSessionRepo) Touch(ctx context.Context, sessionID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `update chat_sessions set updated_at = now() where id = $1`, sessionID)
	if err != nil {
		return fmt.Errorf("chat: pg touch: %w", err)
	}
	return nil
}

func (r *pgSessionRepo) AppendMessage(ctx context.Context, sessionID uuid.UUID, role, content string) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("chat: pg begin: %w", err)
	}
	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback(ctx)
		}
	}()
	if _, err := tx.Exec(ctx, `
		insert into chat_messages (id, session_id, role, content)
		values ($1, $2, $3, $4)
	`, uuid.New(), sessionID, role, content); err != nil {
		return fmt.Errorf("chat: pg insert message: %w", err)
	}
	if _, err := tx.Exec(ctx, `update chat_sessions set updated_at = now() where id = $1`, sessionID); err != nil {
		return fmt.Errorf("chat: pg bump updated_at: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("chat: pg commit: %w", err)
	}
	committed = true
	return nil
}

func (r *pgSessionRepo) ListSessions(ctx context.Context, ownerID uuid.UUID) ([]Session, error) {
	rows, err := r.pool.Query(ctx, `
		select id, owner_id, title, locale, created_at, updated_at
		from chat_sessions
		where owner_id = $1
		order by updated_at desc
	`, ownerID)
	if err != nil {
		return nil, fmt.Errorf("chat: pg list: %w", err)
	}
	defer rows.Close()
	out := make([]Session, 0)
	for rows.Next() {
		var s Session
		if err := rows.Scan(&s.ID, &s.OwnerID, &s.Title, &s.Locale, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, fmt.Errorf("chat: pg scan: %w", err)
		}
		out = append(out, s)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("chat: pg rows: %w", err)
	}
	return out, nil
}

func (r *pgSessionRepo) GetMessages(ctx context.Context, ownerID, sessionID uuid.UUID) ([]StoredMessage, error) {
	// Owner-scoped check first so foreign sessions return ErrSessionNotFound
	// even when they exist.
	var owner uuid.UUID
	err := r.pool.QueryRow(ctx, `select owner_id from chat_sessions where id = $1`, sessionID).Scan(&owner)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrSessionNotFound
		}
		return nil, fmt.Errorf("chat: pg owner check: %w", err)
	}
	if owner != ownerID {
		return nil, ErrSessionNotFound
	}
	rows, err := r.pool.Query(ctx, `
		select id, session_id, role, content, created_at
		from chat_messages
		where session_id = $1
		order by created_at asc
	`, sessionID)
	if err != nil {
		return nil, fmt.Errorf("chat: pg list messages: %w", err)
	}
	defer rows.Close()
	out := make([]StoredMessage, 0)
	for rows.Next() {
		var m StoredMessage
		if err := rows.Scan(&m.ID, &m.SessionID, &m.Role, &m.Content, &m.CreatedAt); err != nil {
			return nil, fmt.Errorf("chat: pg scan message: %w", err)
		}
		out = append(out, m)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("chat: pg message rows: %w", err)
	}
	return out, nil
}

func (r *pgSessionRepo) DeleteSession(ctx context.Context, ownerID, sessionID uuid.UUID) error {
	tag, err := r.pool.Exec(ctx, `
		delete from chat_sessions where id = $1 and owner_id = $2
	`, sessionID, ownerID)
	if err != nil {
		return fmt.Errorf("chat: pg delete: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrSessionNotFound
	}
	return nil
}
