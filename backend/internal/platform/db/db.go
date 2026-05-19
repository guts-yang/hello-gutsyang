// Package db wraps the pgx connection pool with the small surface our app
// needs: Open, Ping with a context, and a tiny migration runner driven by SQL
// files embedded into the binary. The HTTP layer never imports pgx directly;
// it goes through the repositories in internal/auth and (later) internal/content
// so the storage boundary stays clean.
package db

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Open parses the DSN, builds a pgxpool.Pool, and verifies connectivity with a
// short ping. Callers are expected to defer pool.Close() before exit.
//
// The DSN can be in URL form (postgres://user:pass@host/db?sslmode=...) or in
// key-value form (host=... user=... ...). Both are forwarded to pgx as-is.
func Open(ctx context.Context, dsn string) (*pgxpool.Pool, error) {
	if dsn == "" {
		return nil, errors.New("db: empty DSN")
	}

	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("db: parse dsn: %w", err)
	}

	if cfg.MaxConns == 0 {
		cfg.MaxConns = 10
	}
	if cfg.MaxConnLifetime == 0 {
		cfg.MaxConnLifetime = time.Hour
	}
	if cfg.MaxConnIdleTime == 0 {
		cfg.MaxConnIdleTime = 30 * time.Minute
	}

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("db: connect: %w", err)
	}

	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("db: ping: %w", err)
	}

	return pool, nil
}
