package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/guts-yang/hello-gutsyang/backend/internal/config"
	"github.com/guts-yang/hello-gutsyang/backend/internal/content"
	"github.com/guts-yang/hello-gutsyang/backend/internal/platform/db"
)

func runContentCommand(args []string) {
	if len(args) < 1 {
		fmt.Fprintln(os.Stderr, "usage: api content <import|export> [path]")
		os.Exit(2)
	}

	cfg := config.Load()
	if cfg.DatabaseURL == "" {
		fmt.Fprintln(os.Stderr, "content: DATABASE_URL is required")
		os.Exit(2)
	}

	defaultPath := filepath.Join(cfg.DataDir, "content.json")
	jsonPath := defaultPath
	if len(args) >= 2 {
		jsonPath = args[1]
	}

	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()

	pool, err := db.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "content: %v\n", err)
		os.Exit(1)
	}
	defer pool.Close()

	switch args[0] {
	case "import":
		if err := content.ImportFileToPostgres(ctx, pool, jsonPath); err != nil {
			fmt.Fprintf(os.Stderr, "content import: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("imported CMS snapshot from %s\n", jsonPath)
	case "export":
		if err := content.ExportPostgresToFile(ctx, pool, jsonPath); err != nil {
			fmt.Fprintf(os.Stderr, "content export: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("exported CMS snapshot to %s\n", jsonPath)
	default:
		fmt.Fprintf(os.Stderr, "unknown subcommand: content %s\n", args[0])
		fmt.Fprintln(os.Stderr, "usage: api content <import|export> [path]")
		os.Exit(2)
	}
}
