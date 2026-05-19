package media

import (
	"context"
	"strings"
	"testing"

	"github.com/guts-yang/hello-gutsyang/backend/internal/model"
)

func TestSanitizeFolderRejectsTraversal(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		folder  string
		wantErr bool
	}{
		{"empty defaults to projects", "", false},
		{"plain folder", "projects", false},
		{"nested folder", "projects/avatars", false},
		{"trailing slash trimmed", "projects/", false},
		{"single dot rejected", ".", true},
		{"double dot rejected", "..", true},
		{"traversal rejected", "../etc", true},
		{"deep traversal rejected", "projects/../../etc", true},
		{"backslash traversal rejected", "..\\windows", true},
		{"absolute rejected", "/etc/passwd", true},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			out, err := sanitizeFolder(tc.folder)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("want error for %q, got %q", tc.folder, out)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error for %q: %v", tc.folder, err)
			}
			if out == "" {
				t.Fatalf("expected non-empty folder for %q", tc.folder)
			}
		})
	}
}

func TestCreateUploadRejectsPathTraversal(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	svc, err := NewService(context.Background(), dir, "http://localhost:8081")
	if err != nil {
		t.Fatalf("new service: %v", err)
	}
	defer svc.Stop()

	_, _, err = svc.CreateUpload(context.Background(), model.MediaUploadRequest{
		Folder:   "../../etc",
		FileName: "passwd",
	})
	if err == nil {
		t.Fatalf("want CreateUpload to reject traversal folder")
	}
}

func TestAssertWithinDataDirBlocksEscape(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	svc, err := NewService(context.Background(), dir, "http://localhost:8081")
	if err != nil {
		t.Fatalf("new service: %v", err)
	}
	defer svc.Stop()

	if err := svc.assertWithinDataDir("../escape.txt"); err == nil {
		t.Fatalf("want escape rejected")
	}
	if err := svc.assertWithinDataDir("projects/avatar.png"); err != nil {
		t.Fatalf("legitimate path was rejected: %v", err)
	}
}

func TestIsAllowedMimeType(t *testing.T) {
	t.Parallel()
	cases := map[string]bool{
		"":                                  false,
		"image/png":                         true,
		"image/jpeg; charset=utf-8":         true,
		"text/html":                         false,
		"application/x-msdownload":          false,
		"IMAGE/PNG":                         true,
		strings.ToUpper("image/svg+xml"):    true,
	}
	for ct, want := range cases {
		if got := IsAllowedMimeType(ct); got != want {
			t.Fatalf("%q: want %t, got %t", ct, want, got)
		}
	}
}
