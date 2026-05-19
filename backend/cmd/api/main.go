package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/guts-yang/hello-gutsyang/backend/internal/auth"
	"github.com/guts-yang/hello-gutsyang/backend/internal/config"
	"github.com/guts-yang/hello-gutsyang/backend/internal/platform/db"
	"github.com/guts-yang/hello-gutsyang/backend/internal/server"
	"github.com/guts-yang/hello-gutsyang/backend/migrations"
)

func main() {
	if len(os.Args) > 1 {
		switch os.Args[1] {
		case "hash":
			runHashCommand(os.Args[2:])
			return
		case "migrate":
			runMigrateCommand(os.Args[2:])
			return
		case "reset-password":
			runResetPasswordCommand(os.Args[2:])
			return
		case "set-email":
			runSetEmailCommand(os.Args[2:])
			return
		case "help", "-h", "--help":
			printHelp()
			return
		}
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	if err := server.Run(ctx, config.Load()); err != nil {
		log.Fatal(err)
	}
}

// runHashCommand prints a bcrypt hash for the given plaintext password so
// operators can populate ADMIN_BOOTSTRAP_PASSWORD_HASH without writing a
// throwaway program. The plaintext never touches disk or persistent state.
func runHashCommand(args []string) {
	if len(args) != 1 {
		fmt.Fprintln(os.Stderr, "usage: api hash <password>")
		os.Exit(2)
	}
	hash, err := auth.HashPassword(args[0])
	if err != nil {
		fmt.Fprintf(os.Stderr, "hash failed: %v\n", err)
		os.Exit(1)
	}
	fmt.Println(hash)
}

// runMigrateCommand drives the embedded SQL migration runner. We deliberately
// keep this offline-friendly: it loads DATABASE_URL from .env / .env.local and
// does not start the HTTP server, so ops can run it in a one-shot init container
// before the API rolls out.
func runMigrateCommand(args []string) {
	cfg := config.Load()
	if cfg.DatabaseURL == "" {
		fmt.Fprintln(os.Stderr, "migrate: DATABASE_URL is required")
		os.Exit(2)
	}

	sub := "up"
	if len(args) > 0 {
		sub = args[0]
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	pool, err := db.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "migrate: %v\n", err)
		os.Exit(1)
	}
	defer pool.Close()

	switch sub {
	case "up":
		ran, err := db.Up(ctx, pool, migrations.FS)
		if err != nil {
			fmt.Fprintf(os.Stderr, "migrate up failed: %v\n", err)
			os.Exit(1)
		}
		if len(ran) == 0 {
			fmt.Println("migrate up: nothing to do (already up to date)")
			return
		}
		for _, m := range ran {
			fmt.Printf("applied %03d_%s\n", m.Version, m.Name)
		}
	case "status":
		entries, err := db.Status(ctx, pool, migrations.FS)
		if err != nil {
			fmt.Fprintf(os.Stderr, "migrate status failed: %v\n", err)
			os.Exit(1)
		}
		if len(entries) == 0 {
			fmt.Println("no migrations found")
			return
		}
		for _, e := range entries {
			state := "pending"
			extra := ""
			if e.Applied {
				state = "applied"
				extra = " at " + e.AppliedAt.Format(time.RFC3339)
			}
			fmt.Printf("%03d_%s\t%s%s\n", e.Version, e.Name, state, extra)
		}
	default:
		fmt.Fprintf(os.Stderr, "unknown subcommand: migrate %s\n", sub)
		fmt.Fprintln(os.Stderr, "usage: api migrate [up|status]")
		os.Exit(2)
	}
}

// runResetPasswordCommand updates the password hash for an existing admin user
// directly in Postgres, and revokes all of that user's active sessions so the
// reset takes effect immediately. Designed for the "I forgot my admin password"
// flow without needing the HTTP server to be running.
func runResetPasswordCommand(args []string) {
	if len(args) != 2 {
		fmt.Fprintln(os.Stderr, "usage: api reset-password <email> <newPassword>")
		os.Exit(2)
	}
	email, newPassword := args[0], args[1]

	cfg := config.Load()
	if cfg.DatabaseURL == "" {
		fmt.Fprintln(os.Stderr, "reset-password: DATABASE_URL is required (in-memory mode persists nothing)")
		os.Exit(2)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pool, err := db.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "reset-password: %v\n", err)
		os.Exit(1)
	}
	defer pool.Close()

	users := auth.NewPGUserRepo(pool)
	sessions := auth.NewPGSessionRepo(pool)

	user, err := users.ByEmail(ctx, email)
	if err != nil {
		fmt.Fprintf(os.Stderr, "reset-password: %v\n", err)
		os.Exit(1)
	}

	hash, err := auth.HashPassword(newPassword)
	if err != nil {
		fmt.Fprintf(os.Stderr, "reset-password: %v\n", err)
		os.Exit(1)
	}
	if err := users.UpdatePassword(ctx, user.ID, hash); err != nil {
		fmt.Fprintf(os.Stderr, "reset-password: %v\n", err)
		os.Exit(1)
	}
	if _, err := sessions.DeleteAllForUser(ctx, user.ID, ""); err != nil {
		fmt.Fprintf(os.Stderr, "reset-password: warning, password reset OK but session purge failed: %v\n", err)
	}
	fmt.Printf("password reset for %s; all sessions revoked\n", user.Email)
}

// runSetEmailCommand swaps the admin email address. Existing sessions keep
// working because user_id does not change; only the login email rotates.
func runSetEmailCommand(args []string) {
	if len(args) != 2 {
		fmt.Fprintln(os.Stderr, "usage: api set-email <oldEmail> <newEmail>")
		os.Exit(2)
	}
	oldEmail, newEmail := args[0], args[1]

	cfg := config.Load()
	if cfg.DatabaseURL == "" {
		fmt.Fprintln(os.Stderr, "set-email: DATABASE_URL is required")
		os.Exit(2)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pool, err := db.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "set-email: %v\n", err)
		os.Exit(1)
	}
	defer pool.Close()

	users := auth.NewPGUserRepo(pool)

	user, err := users.ByEmail(ctx, oldEmail)
	if err != nil {
		fmt.Fprintf(os.Stderr, "set-email: %v\n", err)
		os.Exit(1)
	}
	if err := users.UpdateEmail(ctx, user.ID, newEmail); err != nil {
		fmt.Fprintf(os.Stderr, "set-email: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("email updated: %s → %s\n", oldEmail, newEmail)
}

func printHelp() {
	fmt.Println("usage:")
	fmt.Println("  api                          start the HTTP server")
	fmt.Println("  api hash <password>          print a bcrypt hash for ADMIN_BOOTSTRAP_PASSWORD_HASH")
	fmt.Println("  api migrate up               apply pending SQL migrations")
	fmt.Println("  api migrate status           list applied / pending migrations")
	fmt.Println("  api reset-password <email> <newPassword>")
	fmt.Println("  api set-email <oldEmail> <newEmail>")
}
