package auth

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// LoginAttemptRepo records every admin login attempt (success and failure)
// and answers "is this email/ip currently locked out?" queries. Implementations
// must be safe for concurrent use.
type LoginAttemptRepo interface {
	Record(ctx context.Context, email, ip string, success bool) error
	RecentFailures(ctx context.Context, email, ip string, since time.Time) (int, error)
	Purge(ctx context.Context, before time.Time) (int, error)
}

// LockoutConfig controls the slow-path brute-force defense.
//
//	Threshold: how many failures across the window trip the lockout.
//	Window:    rolling time window for counting failures.
//	BlockFor:  how long the lockout stays in effect (used for Retry-After).
type LockoutConfig struct {
	Threshold int
	Window    time.Duration
	BlockFor  time.Duration
}

// DefaultLockout is the built-in policy. Plan baseline: 5 failures / 15 min →
// 15 min lockout. Plenty of room for typos but tight enough that distributed
// brute-forcing is forced to spread across many IP+email combinations.
func DefaultLockout() LockoutConfig {
	return LockoutConfig{
		Threshold: 5,
		Window:    15 * time.Minute,
		BlockFor:  15 * time.Minute,
	}
}

// memoryAttemptRepo keeps attempts in-process; only used when DATABASE_URL is
// empty (the dev fallback). Records are kept in a flat slice and pruned
// opportunistically on each query to keep memory bounded.
type memoryAttemptRepo struct {
	mu      sync.Mutex
	entries []memoryAttempt
}

type memoryAttempt struct {
	Email   string
	IP      string
	OK      bool
	At      time.Time
}

// NewMemoryAttemptRepo constructs the in-process attempt log.
func NewMemoryAttemptRepo() LoginAttemptRepo { return &memoryAttemptRepo{} }

func (r *memoryAttemptRepo) Record(_ context.Context, email, ip string, success bool) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.entries = append(r.entries, memoryAttempt{
		Email: strings.ToLower(strings.TrimSpace(email)),
		IP:    ip,
		OK:    success,
		At:    time.Now().UTC(),
	})
	return nil
}

func (r *memoryAttemptRepo) RecentFailures(_ context.Context, email, ip string, since time.Time) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	email = strings.ToLower(strings.TrimSpace(email))
	emailMatches, ipMatches := 0, 0
	for _, e := range r.entries {
		if e.OK || e.At.Before(since) {
			continue
		}
		if email != "" && e.Email == email {
			emailMatches++
		}
		if ip != "" && e.IP == ip {
			ipMatches++
		}
	}
	if emailMatches > ipMatches {
		return emailMatches, nil
	}
	return ipMatches, nil
}

func (r *memoryAttemptRepo) Purge(_ context.Context, before time.Time) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := r.entries[:0]
	removed := 0
	for _, e := range r.entries {
		if e.At.Before(before) {
			removed++
			continue
		}
		out = append(out, e)
	}
	r.entries = out
	return removed, nil
}

// pgAttemptRepo is the postgres-backed LoginAttemptRepo, hitting the table
// from 003_admin_login_attempts.sql.
type pgAttemptRepo struct {
	pool *pgxpool.Pool
}

// NewPGAttemptRepo constructs a postgres-backed LoginAttemptRepo.
func NewPGAttemptRepo(pool *pgxpool.Pool) LoginAttemptRepo { return &pgAttemptRepo{pool: pool} }

func (r *pgAttemptRepo) Record(ctx context.Context, email, ip string, success bool) error {
	_, err := r.pool.Exec(ctx, `
		insert into admin_login_attempts (email, ip, succeeded)
		values ($1, $2, $3)
	`, strings.ToLower(strings.TrimSpace(email)), ip, success)
	if err != nil {
		return fmt.Errorf("auth: pg attempt record: %w", err)
	}
	return nil
}

func (r *pgAttemptRepo) RecentFailures(ctx context.Context, email, ip string, since time.Time) (int, error) {
	row := r.pool.QueryRow(ctx, `
		select greatest(
			(select count(*) from admin_login_attempts
			   where succeeded = false
			     and attempted_at > $3
			     and lower(email) = lower($1)),
			(select count(*) from admin_login_attempts
			   where succeeded = false
			     and attempted_at > $3
			     and ip = $2)
		)
	`, strings.TrimSpace(email), ip, since)
	var n int
	if err := row.Scan(&n); err != nil {
		return 0, fmt.Errorf("auth: pg attempt count: %w", err)
	}
	return n, nil
}

func (r *pgAttemptRepo) Purge(ctx context.Context, before time.Time) (int, error) {
	tag, err := r.pool.Exec(ctx, `delete from admin_login_attempts where attempted_at < $1`, before)
	if err != nil {
		return 0, fmt.Errorf("auth: pg attempt purge: %w", err)
	}
	return int(tag.RowsAffected()), nil
}
