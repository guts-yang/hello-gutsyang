// Package audit records admin actions into the admin_audit table (or an
// in-memory fallback) and exposes a paginated read API. Writes are best-effort:
// we never fail the user-visible action because the audit insert flaked.
package audit

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Entry is one row of the audit log.
type Entry struct {
	ID        uuid.UUID
	UserID    *uuid.UUID
	Action    string
	Target    string
	IP        string
	UserAgent string
	Meta      map[string]any
	CreatedAt time.Time
}

// ListFilter narrows what List() returns.
type ListFilter struct {
	Action string
	Limit  int
	Before time.Time
}

// Repo is the audit persistence boundary.
type Repo interface {
	Record(ctx context.Context, e Entry) error
	List(ctx context.Context, f ListFilter) ([]Entry, error)
}

// Service wraps a Repo with a logger-friendly fire-and-forget Record() that
// the HTTP layer can call inside hot paths without worrying about errors.
type Service struct {
	repo Repo
}

// NewService builds the audit Service. Pass nil repo to disable auditing
// silently (tests that don't care about audit can do this).
func NewService(repo Repo) *Service { return &Service{repo: repo} }

// Record fire-and-forgets an audit entry. Errors are swallowed because the
// caller's primary action already succeeded; we don't want a flaky audit DB
// to surface as a user-facing failure.
func (s *Service) Record(ctx context.Context, e Entry) {
	if s == nil || s.repo == nil {
		return
	}
	if e.CreatedAt.IsZero() {
		e.CreatedAt = time.Now().UTC()
	}
	if e.ID == uuid.Nil {
		e.ID = uuid.New()
	}
	_ = s.repo.Record(ctx, e)
}

// List returns audit entries newest-first, applying the filter. List
// surfaces errors so the read endpoint can return 500.
func (s *Service) List(ctx context.Context, f ListFilter) ([]Entry, error) {
	if s == nil || s.repo == nil {
		return nil, nil
	}
	if f.Limit <= 0 || f.Limit > 200 {
		f.Limit = 50
	}
	return s.repo.List(ctx, f)
}

// memoryRepo keeps audit entries in a slice. Used when DATABASE_URL is empty.
type memoryRepo struct {
	mu      sync.RWMutex
	entries []Entry
}

// NewMemoryRepo builds an in-process Repo. Capacity is unbounded; the
// session-gc loop in server.Run does not yet trim it because the dev
// fallback is meant to be short-lived.
func NewMemoryRepo() Repo { return &memoryRepo{} }

func (r *memoryRepo) Record(_ context.Context, e Entry) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.entries = append(r.entries, e)
	return nil
}

func (r *memoryRepo) List(_ context.Context, f ListFilter) ([]Entry, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]Entry, 0, len(r.entries))
	for _, e := range r.entries {
		if f.Action != "" && e.Action != f.Action {
			continue
		}
		if !f.Before.IsZero() && !e.CreatedAt.Before(f.Before) {
			continue
		}
		out = append(out, e)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	if len(out) > f.Limit {
		out = out[:f.Limit]
	}
	return out, nil
}

// pgRepo is the postgres-backed audit Repo.
type pgRepo struct {
	pool *pgxpool.Pool
}

// NewPGRepo builds a postgres-backed audit Repo over the given pool.
func NewPGRepo(pool *pgxpool.Pool) Repo { return &pgRepo{pool: pool} }

func (r *pgRepo) Record(ctx context.Context, e Entry) error {
	var meta any
	if e.Meta != nil {
		raw, err := json.Marshal(e.Meta)
		if err != nil {
			return fmt.Errorf("audit: marshal meta: %w", err)
		}
		meta = raw
	}
	var userID any
	if e.UserID != nil {
		userID = *e.UserID
	}
	_, err := r.pool.Exec(ctx, `
		insert into admin_audit (id, user_id, action, target, ip, user_agent, meta, created_at)
		values ($1, $2, $3, $4, $5, $6, $7, $8)
	`, e.ID, userID, e.Action, nullable(e.Target), nullable(e.IP), nullable(e.UserAgent), meta, e.CreatedAt)
	if err != nil {
		return fmt.Errorf("audit: pg insert: %w", err)
	}
	return nil
}

func (r *pgRepo) List(ctx context.Context, f ListFilter) ([]Entry, error) {
	args := []any{f.Limit}
	query := `select id, user_id, action, coalesce(target, ''), coalesce(ip, ''), coalesce(user_agent, ''),
	          coalesce(meta::text, ''), created_at from admin_audit`
	conds := []string{}
	if f.Action != "" {
		args = append(args, f.Action)
		conds = append(conds, fmt.Sprintf("action = $%d", len(args)))
	}
	if !f.Before.IsZero() {
		args = append(args, f.Before)
		conds = append(conds, fmt.Sprintf("created_at < $%d", len(args)))
	}
	if len(conds) > 0 {
		query += " where " + joinConds(conds, " and ")
	}
	query += " order by created_at desc limit $1"

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("audit: pg list: %w", err)
	}
	defer rows.Close()

	out := make([]Entry, 0)
	for rows.Next() {
		var e Entry
		var userID *uuid.UUID
		var metaText string
		if err := rows.Scan(&e.ID, &userID, &e.Action, &e.Target, &e.IP, &e.UserAgent, &metaText, &e.CreatedAt); err != nil {
			return nil, fmt.Errorf("audit: pg scan: %w", err)
		}
		e.UserID = userID
		if metaText != "" {
			_ = json.Unmarshal([]byte(metaText), &e.Meta)
		}
		out = append(out, e)
	}
	if err := rows.Err(); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return out, nil
		}
		return nil, err
	}
	return out, nil
}

func joinConds(conds []string, sep string) string {
	out := ""
	for i, c := range conds {
		if i > 0 {
			out += sep
		}
		out += c
	}
	return out
}

func nullable(s string) any {
	if s == "" {
		return nil
	}
	return s
}
