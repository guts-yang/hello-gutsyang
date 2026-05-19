package content

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/guts-yang/hello-gutsyang/backend/internal/model"
)

func TestNewServiceSeedsContent(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	svc, err := NewService(dir)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}
	home, err := svc.Home(context.Background())
	if err != nil {
		t.Fatalf("Home: %v", err)
	}
	if home.Profile.NameZH == "" {
		t.Fatalf("expected seed profile to be populated")
	}
	if len(home.Projects) == 0 {
		t.Fatalf("expected seed projects to be present")
	}
}

func TestPersistIsAtomicAndCleansTempFile(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	svc, err := NewService(dir)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}

	updated, err := svc.UpdateProfile(context.Background(), model.Profile{
		NameZH: "测试",
		NameEN: "Test",
		Handle: "tester",
	})
	if err != nil {
		t.Fatalf("UpdateProfile: %v", err)
	}
	if updated.ID != "main" {
		t.Fatalf("want id=main, got %q", updated.ID)
	}

	// content.json must be valid JSON after the rename, never half-written.
	body, err := os.ReadFile(filepath.Join(dir, "content.json"))
	if err != nil {
		t.Fatalf("read snapshot: %v", err)
	}
	var snap model.ContentSnapshot
	if err := json.Unmarshal(body, &snap); err != nil {
		t.Fatalf("snapshot is not valid JSON: %v", err)
	}
	if snap.Profile.NameZH != "测试" {
		t.Fatalf("snapshot lost the update: %+v", snap.Profile)
	}

	// The temp staging file must not be left behind.
	if _, err := os.Stat(filepath.Join(dir, "content.json.tmp")); !os.IsNotExist(err) {
		t.Fatalf("temp file should have been renamed away, got err=%v", err)
	}
}

func TestPersistRoundTripSurvivesReload(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	svc, err := NewService(dir)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}
	if _, err := svc.UpdateProfile(context.Background(), model.Profile{
		NameZH: "再见",
		NameEN: "Bye",
		Handle: "x",
	}); err != nil {
		t.Fatalf("UpdateProfile: %v", err)
	}

	// A fresh service must read back the persisted snapshot, not reseed.
	svc2, err := NewService(dir)
	if err != nil {
		t.Fatalf("reload NewService: %v", err)
	}
	profile, err := svc2.Profile(context.Background())
	if err != nil {
		t.Fatalf("Profile: %v", err)
	}
	if profile.NameZH != "再见" {
		t.Fatalf("snapshot did not round-trip; got %q", profile.NameZH)
	}
}
