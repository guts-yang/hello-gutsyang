package db

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"path"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Migration represents one NNN_name.sql file embedded into the binary.
// Version is the leading integer; Name is the trailing slug; SQL is the file
// body to be executed as a single batch inside a transaction.
type Migration struct {
	Version int
	Name    string
	SQL     string
}

// AppliedMigration is one row in the schema_migrations bookkeeping table.
type AppliedMigration struct {
	Version   int
	Name      string
	AppliedAt time.Time
}

// LoadMigrations walks the provided fs.FS at its root, picking files matching
// NNN_*.sql and returning them sorted by version. The fs is expected to be
// produced by //go:embed; non-matching files are ignored so the same FS can
// also host a doc README or similar.
func LoadMigrations(efs fs.FS) ([]Migration, error) {
	entries, err := fs.ReadDir(efs, ".")
	if err != nil {
		return nil, fmt.Errorf("migrate: read dir: %w", err)
	}

	out := make([]Migration, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if !strings.HasSuffix(name, ".sql") {
			continue
		}
		stem := strings.TrimSuffix(name, ".sql")
		parts := strings.SplitN(stem, "_", 2)
		if len(parts) != 2 {
			continue
		}
		version, err := strconv.Atoi(parts[0])
		if err != nil {
			continue
		}
		body, err := fs.ReadFile(efs, path.Join(".", name))
		if err != nil {
			return nil, fmt.Errorf("migrate: read %s: %w", name, err)
		}
		out = append(out, Migration{
			Version: version,
			Name:    parts[1],
			SQL:     string(body),
		})
	}

	sort.Slice(out, func(i, j int) bool { return out[i].Version < out[j].Version })
	for i := 1; i < len(out); i++ {
		if out[i].Version == out[i-1].Version {
			return nil, fmt.Errorf("migrate: duplicate version %d", out[i].Version)
		}
	}
	return out, nil
}

// EnsureMigrationsTable creates the bookkeeping table if it does not exist.
// Separated so callers (status, up) can both rely on it without duplicating SQL.
func EnsureMigrationsTable(ctx context.Context, pool *pgxpool.Pool) error {
	_, err := pool.Exec(ctx, `
		create table if not exists schema_migrations (
			version int primary key,
			name text not null,
			applied_at timestamptz not null default now()
		)
	`)
	if err != nil {
		return fmt.Errorf("migrate: ensure table: %w", err)
	}
	return nil
}

// AppliedVersions returns the set of versions already applied, in ascending
// order. The caller can diff against LoadMigrations() to plan pending work.
func AppliedVersions(ctx context.Context, pool *pgxpool.Pool) ([]AppliedMigration, error) {
	rows, err := pool.Query(ctx, `select version, name, applied_at from schema_migrations order by version asc`)
	if err != nil {
		return nil, fmt.Errorf("migrate: list applied: %w", err)
	}
	defer rows.Close()

	var out []AppliedMigration
	for rows.Next() {
		var m AppliedMigration
		if err := rows.Scan(&m.Version, &m.Name, &m.AppliedAt); err != nil {
			return nil, fmt.Errorf("migrate: scan applied: %w", err)
		}
		out = append(out, m)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("migrate: rows: %w", err)
	}
	return out, nil
}

// Up applies every pending migration in version order. Each migration runs in
// its own transaction so a partial failure leaves earlier ones committed and
// the failed one rolled back; the next `migrate up` will retry from there.
// Returns the migrations that were actually applied in this call.
func Up(ctx context.Context, pool *pgxpool.Pool, efs fs.FS) ([]Migration, error) {
	if err := EnsureMigrationsTable(ctx, pool); err != nil {
		return nil, err
	}
	migrations, err := LoadMigrations(efs)
	if err != nil {
		return nil, err
	}
	applied, err := AppliedVersions(ctx, pool)
	if err != nil {
		return nil, err
	}
	appliedSet := make(map[int]struct{}, len(applied))
	for _, m := range applied {
		appliedSet[m.Version] = struct{}{}
	}

	var ran []Migration
	for _, m := range migrations {
		if _, ok := appliedSet[m.Version]; ok {
			continue
		}
		if err := applyOne(ctx, pool, m); err != nil {
			return ran, err
		}
		ran = append(ran, m)
	}
	return ran, nil
}

func applyOne(ctx context.Context, pool *pgxpool.Pool, m Migration) error {
	tx, err := pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("migrate: begin %d: %w", m.Version, err)
	}
	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback(ctx)
		}
	}()

	if _, err := tx.Exec(ctx, m.SQL); err != nil {
		return fmt.Errorf("migrate: exec %d_%s: %w", m.Version, m.Name, err)
	}
	if _, err := tx.Exec(ctx, `insert into schema_migrations (version, name) values ($1, $2)`, m.Version, m.Name); err != nil {
		return fmt.Errorf("migrate: record %d_%s: %w", m.Version, m.Name, err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("migrate: commit %d_%s: %w", m.Version, m.Name, err)
	}
	committed = true
	return nil
}

// Status returns the planned vs applied diff so the CLI can render a table.
type StatusEntry struct {
	Version   int
	Name      string
	Applied   bool
	AppliedAt time.Time
}

// Status reads both the planned migrations (from the embedded fs) and the
// applied ones (from the database) and produces a unified, version-sorted list.
// Returns ErrUnknownMigration if the database contains a version that no
// embedded file matches; that usually means somebody downgraded the binary.
var ErrUnknownMigration = errors.New("migrate: database has a migration newer than the binary")

func Status(ctx context.Context, pool *pgxpool.Pool, efs fs.FS) ([]StatusEntry, error) {
	if err := EnsureMigrationsTable(ctx, pool); err != nil {
		return nil, err
	}
	planned, err := LoadMigrations(efs)
	if err != nil {
		return nil, err
	}
	applied, err := AppliedVersions(ctx, pool)
	if err != nil {
		return nil, err
	}
	appliedMap := make(map[int]AppliedMigration, len(applied))
	for _, a := range applied {
		appliedMap[a.Version] = a
	}
	plannedSet := make(map[int]struct{}, len(planned))
	for _, p := range planned {
		plannedSet[p.Version] = struct{}{}
	}
	for v := range appliedMap {
		if _, ok := plannedSet[v]; !ok {
			return nil, fmt.Errorf("%w: version %d", ErrUnknownMigration, v)
		}
	}

	out := make([]StatusEntry, 0, len(planned))
	for _, p := range planned {
		entry := StatusEntry{Version: p.Version, Name: p.Name}
		if a, ok := appliedMap[p.Version]; ok {
			entry.Applied = true
			entry.AppliedAt = a.AppliedAt
		}
		out = append(out, entry)
	}
	return out, nil
}
