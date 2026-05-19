package config

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	Addr              string
	PublicBaseURL     string
	AppOrigin         string
	AllowedOrigins    []string
	DataDir           string
	DatabaseURL       string
	AdminEmail        string
	AdminPassword     string
	AdminPasswordHash string
	DeepSeekAPIKey    string
	DeepSeekBaseURL   string
	DeepSeekModel     string
	SessionCookie     string
	CookieSecure      CookieSecureMode

	MediaMaxUploadBytes int64

	RateLimitLogin RateLimitConfig
	RateLimitChat  RateLimitConfig
	RateLimitPDF   RateLimitConfig

	LoginLockout LockoutConfig
}

// LockoutConfig describes the slow-path brute-force defense that backs the
// login attempt counter. Mirrors auth.LockoutConfig so config can stay a leaf
// package; server.go re-shapes this into the auth-package value at startup.
type LockoutConfig struct {
	Threshold int
	Window    time.Duration
	BlockFor  time.Duration
}

// CookieSecureMode controls whether the admin session cookie is marked Secure.
// `auto` lets the server decide based on AppOrigin (https → Secure=true). `on`
// and `off` are hard overrides for ops who run behind TLS terminators that
// rewrite the origin.
type CookieSecureMode string

const (
	CookieSecureAuto CookieSecureMode = "auto"
	CookieSecureOn   CookieSecureMode = "on"
	CookieSecureOff  CookieSecureMode = "off"
)

// Resolve returns whether the cookie should be set as Secure given the current
// app origin. It exists so the HTTP layer does not have to re-parse the URL.
func (m CookieSecureMode) Resolve(appOrigin string) bool {
	switch m {
	case CookieSecureOn:
		return true
	case CookieSecureOff:
		return false
	default:
		return strings.HasPrefix(strings.ToLower(appOrigin), "https://")
	}
}

// RateLimitConfig describes a token bucket allowance per key.
// Burst is the bucket size, Window is the refill window for that many tokens.
type RateLimitConfig struct {
	Burst  int
	Window time.Duration
}

func Load() Config {
	loadDotEnv()

	dataDir := os.Getenv("BACKEND_DATA_DIR")
	if dataDir == "" {
		dataDir = filepath.Join(".", ".backend-data")
	}

	appOrigin := getEnv("APP_ORIGIN", "http://localhost:3000")

	return Config{
		Addr:              getEnv("BACKEND_ADDR", ":8081"),
		PublicBaseURL:     getEnv("GO_API_URL", "http://localhost:8081"),
		AppOrigin:         appOrigin,
		AllowedOrigins:    parseAllowedOrigins(appOrigin, os.Getenv("ALLOWED_ORIGINS")),
		DataDir:           dataDir,
		DatabaseURL:       os.Getenv("DATABASE_URL"),
		AdminEmail:        os.Getenv("ADMIN_BOOTSTRAP_EMAIL"),
		AdminPassword:     os.Getenv("ADMIN_BOOTSTRAP_PASSWORD"),
		AdminPasswordHash: os.Getenv("ADMIN_BOOTSTRAP_PASSWORD_HASH"),
		DeepSeekAPIKey:    os.Getenv("DEEPSEEK_API_KEY"),
		DeepSeekBaseURL:   getEnv("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
		DeepSeekModel:     getEnv("DEEPSEEK_MODEL", "deepseek-v4-flash"),
		SessionCookie:     getEnv("ADMIN_SESSION_COOKIE", "hello_gutsyang_admin_session"),
		CookieSecure:      parseCookieSecure(os.Getenv("COOKIE_SECURE")),

		MediaMaxUploadBytes: getEnvInt64("MEDIA_MAX_UPLOAD_BYTES", 10*1024*1024),

		RateLimitLogin: RateLimitConfig{
			Burst:  getEnvInt("RATE_LIMIT_LOGIN_BURST", 10),
			Window: getEnvDuration("RATE_LIMIT_LOGIN_WINDOW", 5*time.Minute),
		},
		RateLimitChat: RateLimitConfig{
			Burst:  getEnvInt("RATE_LIMIT_CHAT_BURST", 5),
			Window: getEnvDuration("RATE_LIMIT_CHAT_WINDOW", 30*time.Second),
		},
		RateLimitPDF: RateLimitConfig{
			Burst:  getEnvInt("RATE_LIMIT_PDF_BURST", 10),
			Window: getEnvDuration("RATE_LIMIT_PDF_WINDOW", 5*time.Minute),
		},

		LoginLockout: LockoutConfig{
			Threshold: getEnvInt("LOGIN_LOCKOUT_THRESHOLD", 5),
			Window:    getEnvDuration("LOGIN_LOCKOUT_WINDOW", 15*time.Minute),
			BlockFor:  getEnvDuration("LOGIN_LOCKOUT_BLOCK_FOR", 15*time.Minute),
		},
	}
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback
	}
	v, err := strconv.Atoi(raw)
	if err != nil || v <= 0 {
		return fallback
	}
	return v
}

func getEnvInt64(key string, fallback int64) int64 {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback
	}
	v, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || v <= 0 {
		return fallback
	}
	return v
}

func getEnvDuration(key string, fallback time.Duration) time.Duration {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback
	}
	d, err := time.ParseDuration(raw)
	if err != nil || d <= 0 {
		return fallback
	}
	return d
}

// parseAllowedOrigins always includes the primary AppOrigin plus any extras
// provided via the ALLOWED_ORIGINS env var (comma separated). Localhost
// development origins are added by default to keep the dev experience smooth.
func parseAllowedOrigins(appOrigin, extra string) []string {
	seen := map[string]struct{}{}
	out := []string{}
	add := func(value string) {
		v := strings.TrimSpace(value)
		v = strings.TrimRight(v, "/")
		if v == "" {
			return
		}
		if _, ok := seen[v]; ok {
			return
		}
		seen[v] = struct{}{}
		out = append(out, v)
	}

	add(appOrigin)
	for _, candidate := range strings.Split(extra, ",") {
		add(candidate)
	}
	for _, candidate := range []string{
		"http://localhost:3000",
		"http://localhost:3001",
		"http://127.0.0.1:3000",
		"http://127.0.0.1:3001",
	} {
		add(candidate)
	}

	return out
}

func parseCookieSecure(raw string) CookieSecureMode {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "true", "1", "on", "yes":
		return CookieSecureOn
	case "false", "0", "off", "no":
		return CookieSecureOff
	default:
		return CookieSecureAuto
	}
}

func loadDotEnv() {
	for _, candidate := range []string{".env.local", ".env", "../.env.local", "../.env"} {
		_ = godotenv.Overload(candidate)
	}
}
