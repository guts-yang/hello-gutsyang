package content

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/guts-yang/hello-gutsyang/backend/internal/model"
)

// LoadSnapshotFile reads a content.json snapshot from disk.
func LoadSnapshotFile(path string) (model.ContentSnapshot, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return model.ContentSnapshot{}, err
	}
	var snap model.ContentSnapshot
	if err := json.Unmarshal(raw, &snap); err != nil {
		return model.ContentSnapshot{}, fmt.Errorf("decode snapshot: %w", err)
	}
	return snap, nil
}

// WriteSnapshotFile writes a snapshot to disk with atomic replace.
func WriteSnapshotFile(path string, snap model.ContentSnapshot) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	body, err := json.MarshalIndent(snap, "", "  ")
	if err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, body, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

// ImportFileToPostgres loads content.json and upserts all rows into Postgres.
func ImportFileToPostgres(ctx context.Context, pool *pgxpool.Pool, jsonPath string) error {
	snap, err := LoadSnapshotFile(jsonPath)
	if err != nil {
		return err
	}
	pg := newPGRepo(pool)
	return pg.ImportSnapshot(ctx, snap)
}

// ExportPostgresToFile dumps the current Postgres CMS state to content.json.
func ExportPostgresToFile(ctx context.Context, pool *pgxpool.Pool, jsonPath string) error {
	pg := newPGRepo(pool)
	snap, err := pg.Snapshot(ctx)
	if err != nil {
		return err
	}
	return WriteSnapshotFile(jsonPath, snap)
}
