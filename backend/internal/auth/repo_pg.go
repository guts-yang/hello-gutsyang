package auth

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// pgUserRepo is the postgres-backed UserRepo. All email comparisons are done
// via lower() so callers can write "Tony@Example.com" and still match the
// stored row.
type pgUserRepo struct {
	pool *pgxpool.Pool
}

// NewPGUserRepo constructs a postgres-backed UserRepo over the given pool.
func NewPGUserRepo(pool *pgxpool.Pool) UserRepo { return &pgUserRepo{pool: pool} }

func (r *pgUserRepo) ByEmail(ctx context.Context, email string) (*UserRecord, error) {
	row := r.pool.QueryRow(ctx, `
		select id, email, password_hash, role, created_at
		from admin_users
		where lower(email) = lower($1)
		limit 1
	`, strings.TrimSpace(email))

	var u UserRecord
	if err := row.Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Role, &u.CreatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("auth: pg by-email: %w", err)
	}
	return &u, nil
}

func (r *pgUserRepo) ByID(ctx context.Context, id uuid.UUID) (*UserRecord, error) {
	row := r.pool.QueryRow(ctx, `
		select id, email, password_hash, role, created_at
		from admin_users
		where id = $1
	`, id)

	var u UserRecord
	if err := row.Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Role, &u.CreatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("auth: pg by-id: %w", err)
	}
	return &u, nil
}

func (r *pgUserRepo) Bootstrap(ctx context.Context, email, hash string) (*UserRecord, bool, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	row := r.pool.QueryRow(ctx, `
		insert into admin_users (email, password_hash, role)
		values ($1, $2, 'admin')
		on conflict do nothing
		returning id, email, password_hash, role, created_at
	`, email, hash)

	var u UserRecord
	if err := row.Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Role, &u.CreatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			existing, lookupErr := r.ByEmail(ctx, email)
			if lookupErr != nil {
				return nil, false, fmt.Errorf("auth: pg bootstrap lookup: %w", lookupErr)
			}
			return existing, false, nil
		}
		return nil, false, fmt.Errorf("auth: pg bootstrap insert: %w", err)
	}
	return &u, true, nil
}

func (r *pgUserRepo) UpdatePassword(ctx context.Context, id uuid.UUID, hash string) error {
	tag, err := r.pool.Exec(ctx, `update admin_users set password_hash = $2 where id = $1`, id, hash)
	if err != nil {
		return fmt.Errorf("auth: pg update password: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrUserNotFound
	}
	return nil
}

func (r *pgUserRepo) UpdateEmail(ctx context.Context, id uuid.UUID, newEmail string) error {
	newEmail = strings.ToLower(strings.TrimSpace(newEmail))
	tag, err := r.pool.Exec(ctx, `update admin_users set email = $2 where id = $1`, id, newEmail)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return ErrEmailTaken
		}
		return fmt.Errorf("auth: pg update email: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrUserNotFound
	}
	return nil
}

func (r *pgUserRepo) Count(ctx context.Context) (int, error) {
	row := r.pool.QueryRow(ctx, `select count(*) from admin_users`)
	var n int
	if err := row.Scan(&n); err != nil {
		return 0, fmt.Errorf("auth: pg count: %w", err)
	}
	return n, nil
}

// pgSessionRepo is the postgres-backed SessionRepo. We rely on the
// admin_sessions table from 001_init.sql plus the IP/UA columns added in
// 002_admin_session_meta.sql; older Phase 0 deployments need to migrate before
// using this repo.
type pgSessionRepo struct {
	pool *pgxpool.Pool
}

// NewPGSessionRepo constructs a postgres-backed SessionRepo over the given pool.
func NewPGSessionRepo(pool *pgxpool.Pool) SessionRepo { return &pgSessionRepo{pool: pool} }

func (r *pgSessionRepo) Create(ctx context.Context, s SessionRecord) error {
	_, err := r.pool.Exec(ctx, `
		insert into admin_sessions (id, user_id, token, ip, user_agent, expires_at, last_seen_at)
		values ($1, $2, $3, $4, $5, $6, $7)
	`, s.ID, s.UserID, s.Token, nullable(s.IP), nullable(s.UserAgent), s.ExpiresAt, s.LastSeenAt)
	if err != nil {
		return fmt.Errorf("auth: pg session create: %w", err)
	}
	return nil
}

func (r *pgSessionRepo) ByToken(ctx context.Context, token string) (*SessionRecord, error) {
	if token == "" {
		return nil, ErrSessionNotFound
	}
	row := r.pool.QueryRow(ctx, `
		select id, user_id, token, coalesce(ip, ''), coalesce(user_agent, ''),
		       created_at, coalesce(last_seen_at, created_at), expires_at
		from admin_sessions
		where token = $1
	`, token)

	var s SessionRecord
	if err := row.Scan(&s.ID, &s.UserID, &s.Token, &s.IP, &s.UserAgent, &s.CreatedAt, &s.LastSeenAt, &s.ExpiresAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrSessionNotFound
		}
		return nil, fmt.Errorf("auth: pg session by-token: %w", err)
	}
	if s.ExpiresAt.Before(time.Now().UTC()) {
		return nil, ErrSessionNotFound
	}
	return &s, nil
}

func (r *pgSessionRepo) ByTokenWithUser(ctx context.Context, token string) (*SessionRecord, *UserRecord, error) {
	if token == "" {
		return nil, nil, ErrSessionNotFound
	}
	row := r.pool.QueryRow(ctx, `
		select s.id, s.user_id, s.token, coalesce(s.ip, ''), coalesce(s.user_agent, ''),
		       s.created_at, coalesce(s.last_seen_at, s.created_at), s.expires_at,
		       u.id, u.email, u.password_hash, u.role, u.created_at
		from admin_sessions s
		join admin_users u on u.id = s.user_id
		where s.token = $1
	`, token)

	var s SessionRecord
	var u UserRecord
	if err := row.Scan(
		&s.ID, &s.UserID, &s.Token, &s.IP, &s.UserAgent, &s.CreatedAt, &s.LastSeenAt, &s.ExpiresAt,
		&u.ID, &u.Email, &u.PasswordHash, &u.Role, &u.CreatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil, ErrSessionNotFound
		}
		return nil, nil, fmt.Errorf("auth: pg session by-token with user: %w", err)
	}
	if s.ExpiresAt.Before(time.Now().UTC()) {
		return nil, nil, ErrSessionNotFound
	}
	return &s, &u, nil
}

func (r *pgSessionRepo) Touch(ctx context.Context, token string, newExpiry, lastSeen time.Time) error {
	tag, err := r.pool.Exec(ctx, `
		update admin_sessions
		   set expires_at = $2,
		       last_seen_at = $3
		 where token = $1
	`, token, newExpiry, lastSeen)
	if err != nil {
		return fmt.Errorf("auth: pg session touch: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrSessionNotFound
	}
	return nil
}

func (r *pgSessionRepo) Delete(ctx context.Context, token string) error {
	_, err := r.pool.Exec(ctx, `delete from admin_sessions where token = $1`, token)
	if err != nil {
		return fmt.Errorf("auth: pg session delete: %w", err)
	}
	return nil
}

func (r *pgSessionRepo) DeleteByID(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	tag, err := r.pool.Exec(ctx, `
		delete from admin_sessions where id = $1 and user_id = $2
	`, id, userID)
	if err != nil {
		return fmt.Errorf("auth: pg session delete-by-id: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrSessionNotFound
	}
	return nil
}

func (r *pgSessionRepo) DeleteAllForUser(ctx context.Context, userID uuid.UUID, except string) (int, error) {
	tag, err := r.pool.Exec(ctx, `
		delete from admin_sessions
		 where user_id = $1
		   and ($2 = '' or token <> $2)
	`, userID, except)
	if err != nil {
		return 0, fmt.Errorf("auth: pg session delete-all: %w", err)
	}
	return int(tag.RowsAffected()), nil
}

func (r *pgSessionRepo) ListByUser(ctx context.Context, userID uuid.UUID) ([]SessionRecord, error) {
	rows, err := r.pool.Query(ctx, `
		select id, user_id, token, coalesce(ip, ''), coalesce(user_agent, ''),
		       created_at, coalesce(last_seen_at, created_at), expires_at
		from admin_sessions
		where user_id = $1 and expires_at > now()
		order by last_seen_at desc nulls last, created_at desc
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("auth: pg session list: %w", err)
	}
	defer rows.Close()

	out := make([]SessionRecord, 0)
	for rows.Next() {
		var s SessionRecord
		if err := rows.Scan(&s.ID, &s.UserID, &s.Token, &s.IP, &s.UserAgent, &s.CreatedAt, &s.LastSeenAt, &s.ExpiresAt); err != nil {
			return nil, fmt.Errorf("auth: pg session scan: %w", err)
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func (r *pgSessionRepo) PurgeExpired(ctx context.Context) (int, error) {
	tag, err := r.pool.Exec(ctx, `delete from admin_sessions where expires_at <= now()`)
	if err != nil {
		return 0, fmt.Errorf("auth: pg session purge: %w", err)
	}
	return int(tag.RowsAffected()), nil
}

// nullable turns an empty string into a NULL so the DB column stores NULL
// rather than an empty text. Keeps queries on those columns sargable.
func nullable(s string) any {
	if s == "" {
		return nil
	}
	return s
}
