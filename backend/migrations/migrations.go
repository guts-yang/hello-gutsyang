// Package migrations only exists to expose the embedded SQL files to the
// migrate runner in internal/platform/db. Keeping the embed declaration here
// lets us drop new NNN_*.sql files into this directory without touching any
// Go code; the runner picks them up by filename order on the next migrate.
package migrations

import "embed"

//go:embed *.sql
var FS embed.FS
