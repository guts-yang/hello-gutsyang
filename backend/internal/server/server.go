package server

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/guts-yang/hello-gutsyang/backend/internal/ai"
	"github.com/guts-yang/hello-gutsyang/backend/internal/audit"
	"github.com/guts-yang/hello-gutsyang/backend/internal/auth"
	"github.com/guts-yang/hello-gutsyang/backend/internal/config"
	"github.com/guts-yang/hello-gutsyang/backend/internal/content"
	"github.com/guts-yang/hello-gutsyang/backend/internal/media"
	"github.com/guts-yang/hello-gutsyang/backend/internal/model"
	"github.com/guts-yang/hello-gutsyang/backend/internal/platform/cache"
	"github.com/guts-yang/hello-gutsyang/backend/internal/platform/db"
	"github.com/guts-yang/hello-gutsyang/backend/internal/platform/ratelimit"
)

type Server struct {
	cfg             config.Config
	content         *content.Service
	auth            *auth.Service
	audit           *audit.Service
	media           *media.Service
	ai              *ai.Service
	chatRepo        ai.SessionRepo
	cache           *cache.Cache
	allowedOrigins  map[string]struct{}
	loginLimiter    ratelimit.Limiter
	chatLimiter     ratelimit.Limiter
	chatListLimiter ratelimit.Limiter
	adminAILimiter  ratelimit.Limiter

	pool *pgxpool.Pool
}

// csrfCookieName is the companion cookie that backs the double-submit CSRF
// defense. It is non-HttpOnly so server-side fetchers (Next.js Route Handlers /
// Server Actions) can lift it from cookies() and re-attach as a header. Pairs
// 1:1 with the session cookie name from config.
func (s *Server) csrfCookieName() string {
	return s.cfg.SessionCookie + "_csrf"
}

// AuthMode reports the password verification mode for startup logs.
func (s *Server) AuthMode() auth.Mode {
	return s.auth.GetMode()
}

// Close releases resources owned by the server. It is safe to call multiple
// times and on a partially-constructed server (e.g. when New() returned an
// error mid-way).
func (s *Server) Close() {
	if s == nil {
		return
	}
	if s.pool != nil {
		s.pool.Close()
		s.pool = nil
	}
}

func New(ctx context.Context, cfg config.Config) (*Server, error) {
	authSvc, pool, err := buildAuthService(ctx, cfg)
	if err != nil {
		return nil, err
	}

	contentSvc, err := content.NewService(cfg.DataDir, pool)
	if err != nil {
		if pool != nil {
			pool.Close()
		}
		return nil, err
	}
	mediaSvc, err := media.NewService(ctx, cfg.DataDir, cfg.PublicBaseURL)
	if err != nil {
		return nil, err
	}

	var auditRepo audit.Repo
	var chatRepo ai.SessionRepo
	if pool != nil {
		auditRepo = audit.NewPGRepo(pool)
		chatRepo = ai.NewPGSessionRepo(pool)
	} else {
		auditRepo = audit.NewMemoryRepo()
		chatRepo = ai.NewMemorySessionRepo()
	}

	allowed := make(map[string]struct{}, len(cfg.AllowedOrigins))
	for _, origin := range cfg.AllowedOrigins {
		allowed[strings.TrimRight(origin, "/")] = struct{}{}
	}

	srv := &Server{
		cfg:             cfg,
		content:         contentSvc,
		auth:            authSvc,
		audit:           audit.NewService(auditRepo),
		media:           mediaSvc,
		ai:              ai.NewService(contentSvc, cfg.DeepSeekAPIKey, cfg.DeepSeekBaseURL, cfg.DeepSeekModel),
		chatRepo:        chatRepo,
		cache:           cache.New(),
		allowedOrigins:  allowed,
		loginLimiter:    ratelimit.New(cfg.RateLimitLogin.Burst, cfg.RateLimitLogin.Window),
		chatLimiter:     ratelimit.New(cfg.RateLimitChat.Burst, cfg.RateLimitChat.Window),
		chatListLimiter: ratelimit.New(cfg.RateLimitAIList.Burst, cfg.RateLimitAIList.Window),
		adminAILimiter:  ratelimit.New(cfg.RateLimitAdminAI.Burst, cfg.RateLimitAdminAI.Window),
		pool:            pool,
	}
	return srv, nil
}

// isLocalDevOrigin is true when APP_ORIGIN points at a loopback host. Used to
// decide whether a failed DATABASE_URL ping may fall back to in-memory auth.
func isLocalDevOrigin(origin string) bool {
	origin = strings.ToLower(strings.TrimSpace(origin))
	return strings.HasPrefix(origin, "http://localhost:") ||
		strings.HasPrefix(origin, "http://127.0.0.1:") ||
		strings.HasPrefix(origin, "https://localhost:") ||
		strings.HasPrefix(origin, "https://127.0.0.1:")
}

// buildAuthService picks postgres or the in-memory fallback based on
// cfg.DatabaseURL, opens the pool when applicable, runs Bootstrap so the env
// hash/plain ends up in the chosen repo, and finally constructs auth.Service.
func buildAuthService(ctx context.Context, cfg config.Config) (*auth.Service, *pgxpool.Pool, error) {
	var (
		userRepo    auth.UserRepo
		sessionRepo auth.SessionRepo
		attemptRepo auth.LoginAttemptRepo
		pool        *pgxpool.Pool
		mode        auth.Mode
	)

	if cfg.DatabaseURL != "" {
		p, err := db.Open(ctx, cfg.DatabaseURL)
		if err != nil {
			// Local dev often points DATABASE_URL at docker-compose credentials while
			// another Postgres already owns :5432. Fall back to in-memory auth so
			// `npm run dev:backend` still works and ADMIN_BOOTSTRAP_* can seed login.
			if isLocalDevOrigin(cfg.AppOrigin) {
				log.Printf("auth: postgres unavailable (%v); using in-memory auth for local dev", err)
			} else {
				return nil, nil, err
			}
		} else {
			pool = p
			userRepo = auth.NewPGUserRepo(p)
			sessionRepo = auth.NewPGSessionRepo(p)
			attemptRepo = auth.NewPGAttemptRepo(p)
			mode = auth.ModePostgres
		}
	}
	if userRepo == nil {
		userRepo = auth.NewMemoryUserRepo()
		sessionRepo = auth.NewMemorySessionRepo()
		attemptRepo = auth.NewMemoryAttemptRepo()
		mode = auth.ModeMemory
	}

	bootstrapCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	res, err := auth.Bootstrap(bootstrapCtx, userRepo, auth.BootstrapInput{
		Email:         cfg.AdminEmail,
		PasswordHash:  cfg.AdminPasswordHash,
		PasswordPlain: cfg.AdminPassword,
	}, mode)
	if err != nil {
		if pool != nil {
			pool.Close()
		}
		return nil, nil, err
	}

	switch {
	case res.Created:
		log.Printf("auth: bootstrapped admin user (email=%s, mode=%s)", res.Email, res.Mode)
	case res.AlreadyHadAdmin && cfg.AdminPassword != "":
		log.Printf("auth: admin already exists in repo; you can now clear ADMIN_BOOTSTRAP_PASSWORD / _HASH from the env")
	case res.Mode == auth.ModeDisabled:
		log.Printf("auth: no admin configured (set ADMIN_BOOTSTRAP_EMAIL + _PASSWORD_HASH or run `api reset-password`)")
	}

	svc := auth.New(userRepo, sessionRepo, res.Mode, auth.Options{
		Attempts: attemptRepo,
		Lockout: auth.LockoutConfig{
			Threshold: cfg.LoginLockout.Threshold,
			Window:    cfg.LoginLockout.Window,
			BlockFor:  cfg.LoginLockout.BlockFor,
		},
	})
	return svc, pool, nil
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()

	fileServer := http.FileServer(http.Dir(filepath.Join(s.cfg.DataDir, "uploads")))
	mux.Handle("/uploads/", http.StripPrefix("/uploads/", fileServer))

	mux.HandleFunc("GET /healthz", s.handleHealth)
	mux.HandleFunc("GET /v1/public/home", s.handleHome)
	mux.HandleFunc("GET /v1/public/profile", s.handleProfile)
	mux.HandleFunc("GET /v1/public/projects", s.handleProjects)
	mux.HandleFunc("GET /v1/public/projects/{slug}", s.handleProjectBySlug)
	mux.HandleFunc("GET /v1/public/experiences", s.handleExperiences)
	mux.HandleFunc("GET /v1/public/experiences/{slug}", s.handleExperienceBySlug)
	mux.HandleFunc("GET /v1/public/honors", s.handleHonors)
	mux.HandleFunc("GET /v1/public/education", s.handleEducation)
	mux.HandleFunc("GET /v1/public/timeline", s.handleTimeline)

	mux.HandleFunc("POST /v1/admin/login", s.handleLogin)
	mux.HandleFunc("POST /v1/admin/logout", s.handleLogout)
	mux.HandleFunc("GET /v1/admin/session", s.handleSession)
	mux.HandleFunc("POST /v1/admin/password", s.handleAdminChangePassword)
	mux.HandleFunc("PUT /v1/admin/email", s.handleAdminChangeEmail)
	mux.HandleFunc("GET /v1/admin/sessions", s.handleAdminListSessions)
	mux.HandleFunc("DELETE /v1/admin/sessions/{id}", s.handleAdminRevokeSession)
	mux.HandleFunc("POST /v1/admin/sessions/revoke-all", s.handleAdminRevokeAllOtherSessions)
	mux.HandleFunc("GET /v1/admin/audit", s.handleAdminAuditList)
	mux.HandleFunc("GET /v1/admin/stats", s.handleAdminStats)
	mux.HandleFunc("GET /v1/admin/profile", s.handleAdminProfileGet)
	mux.HandleFunc("PUT /v1/admin/profile", s.handleAdminProfilePut)
	mux.HandleFunc("GET /v1/admin/projects", s.handleAdminProjects)
	mux.HandleFunc("POST /v1/admin/projects", s.handleAdminProjectCreate)
	mux.HandleFunc("GET /v1/admin/projects/{id}", s.handleAdminProjectGet)
	mux.HandleFunc("PUT /v1/admin/projects/{id}", s.handleAdminProjectUpdate)
	mux.HandleFunc("DELETE /v1/admin/projects/{id}", s.handleAdminProjectDelete)
	mux.HandleFunc("GET /v1/admin/experiences", s.handleAdminExperiences)
	mux.HandleFunc("POST /v1/admin/experiences", s.handleAdminExperienceCreate)
	mux.HandleFunc("GET /v1/admin/experiences/{id}", s.handleAdminExperienceGet)
	mux.HandleFunc("PUT /v1/admin/experiences/{id}", s.handleAdminExperienceUpdate)
	mux.HandleFunc("DELETE /v1/admin/experiences/{id}", s.handleAdminExperienceDelete)
	mux.HandleFunc("GET /v1/admin/honors", s.handleAdminHonors)
	mux.HandleFunc("POST /v1/admin/honors", s.handleAdminHonorCreate)
	mux.HandleFunc("GET /v1/admin/honors/{id}", s.handleAdminHonorGet)
	mux.HandleFunc("PUT /v1/admin/honors/{id}", s.handleAdminHonorUpdate)
	mux.HandleFunc("DELETE /v1/admin/honors/{id}", s.handleAdminHonorDelete)
	mux.HandleFunc("POST /v1/admin/ai/translate", s.handleAdminTranslate)
	mux.HandleFunc("POST /v1/admin/media/upload-url", s.handleAdminUploadURL)
	mux.HandleFunc("OPTIONS /v1/admin/media/upload/{token}", s.handleUploadOptions)
	mux.HandleFunc("PUT /v1/admin/media/upload/{token}", s.handleUploadBinary)
	mux.HandleFunc("POST /v1/ai/chat", s.handleChat)
	mux.HandleFunc("GET /v1/ai/sessions", s.handleChatSessionsList)
	mux.HandleFunc("GET /v1/ai/sessions/{id}/messages", s.handleChatSessionMessages)
	mux.HandleFunc("DELETE /v1/ai/sessions/{id}", s.handleChatSessionDelete)

	return s.withLogging(s.withCORS(s.withChatOwner(s.withCSRF(mux))))
}

// withCSRF enforces the double-submit cookie check on admin mutations. The
// safe-method side (GET/HEAD/OPTIONS) is always allowed through; login is
// exempt because it is the moment we MINT the CSRF cookie. Everywhere else
// under /v1/admin/*, the request must carry an X-CSRF-Token header equal to
// the csrf cookie or we return 403.
func (s *Server) withCSRF(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !s.csrfRequired(r) {
			next.ServeHTTP(w, r)
			return
		}

		header := r.Header.Get("X-CSRF-Token")
		cookie, err := r.Cookie(s.csrfCookieName())
		if err != nil || cookie.Value == "" {
			writeClientError(w, http.StatusForbidden, "missing csrf token")
			return
		}
		if !auth.CompareCSRFTokens(header, cookie.Value) {
			writeClientError(w, http.StatusForbidden, "invalid csrf token")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// csrfRequired returns true when the request is an admin mutation that must
// carry the CSRF token. Login is exempt (chicken-and-egg: it mints the
// cookie). All non-mutating methods are exempt regardless of path.
func (s *Server) csrfRequired(r *http.Request) bool {
	switch r.Method {
	case http.MethodGet, http.MethodHead, http.MethodOptions:
		return false
	}
	if !strings.HasPrefix(r.URL.Path, "/v1/admin/") {
		return false
	}
	if r.URL.Path == "/v1/admin/login" {
		return false
	}
	return true
}

func (s *Server) withLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start))
	})
}

// withCORS only echoes the Origin header back when it matches the configured
// allow list. Any other Origin (including the empty / unset case for non-browser
// callers like curl or server-to-server fetches) gets no CORS response header,
// which means the browser will block the request — but server-side callers can
// still talk to the API since they ignore CORS entirely.
func (s *Server) withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := strings.TrimRight(r.Header.Get("Origin"), "/")
		if origin != "" {
			if _, ok := s.allowedOrigins[origin]; ok {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Access-Control-Allow-Credentials", "true")
				w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
				w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
			}
			w.Header().Add("Vary", "Origin")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":             true,
		"authConfigured": s.auth.Enabled(),
		"authMode":       string(s.auth.GetMode()),
		"demoMode":       s.ai.DemoMode(),
	})
}

func (s *Server) handleHome(w http.ResponseWriter, r *http.Request) {
	s.respondCachedJSON(w, r, "public:home", 15*time.Second, func() (any, error) {
		return s.content.Home(r.Context())
	})
}

func (s *Server) handleProfile(w http.ResponseWriter, r *http.Request) {
	s.respondCachedJSON(w, r, "public:profile", 30*time.Second, func() (any, error) {
		return s.content.Profile(r.Context())
	})
}

func (s *Server) handleProjects(w http.ResponseWriter, r *http.Request) {
	s.respondCachedJSON(w, r, "public:projects", 30*time.Second, func() (any, error) {
		return s.content.Projects(r.Context(), false)
	})
}

func (s *Server) handleProjectBySlug(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	project, err := s.content.ProjectBySlug(r.Context(), slug)
	if err != nil {
		writeServerError(w, r, err)
		return
	}
	if project == nil {
		writeClientError(w, http.StatusNotFound, "project not found")
		return
	}
	writeJSON(w, http.StatusOK, project)
}

func (s *Server) handleExperiences(w http.ResponseWriter, r *http.Request) {
	s.respondCachedJSON(w, r, "public:experiences", 30*time.Second, func() (any, error) {
		return s.content.Experiences(r.Context(), false)
	})
}

func (s *Server) handleExperienceBySlug(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	item, err := s.content.ExperienceBySlug(r.Context(), slug)
	if err != nil {
		writeServerError(w, r, err)
		return
	}
	if item == nil {
		writeClientError(w, http.StatusNotFound, "experience not found")
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (s *Server) handleHonors(w http.ResponseWriter, r *http.Request) {
	s.respondCachedJSON(w, r, "public:honors", 30*time.Second, func() (any, error) {
		return s.content.Honors(r.Context(), false)
	})
}

func (s *Server) handleEducation(w http.ResponseWriter, r *http.Request) {
	s.respondCachedJSON(w, r, "public:education", 30*time.Second, func() (any, error) {
		return s.content.Education(r.Context())
	})
}

func (s *Server) handleTimeline(w http.ResponseWriter, r *http.Request) {
	s.respondCachedJSON(w, r, "public:timeline", 30*time.Second, func() (any, error) {
		return s.content.Timeline(r.Context())
	})
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	if !s.allowOrLimit(w, s.loginLimiter, clientIP(r), s.cfg.RateLimitLogin.Window) {
		return
	}
	var body model.LoginRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4*1024)).Decode(&body); err != nil {
		writeClientError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	ip := clientIP(r)
	session, err := s.auth.Login(r.Context(), body.Email, body.Password, ip, r.UserAgent())
	if err != nil {
		if auth.IsLockedOut(err) {
			retry := int(s.auth.LockoutConfig().BlockFor.Seconds())
			if retry < 1 {
				retry = 60
			}
			s.audit.Record(r.Context(), audit.Entry{
				Action: "login.locked",
				Target: body.Email,
				IP:     ip,
				UserAgent: r.UserAgent(),
			})
			w.Header().Set("Retry-After", itoa(retry))
			writeClientError(w, http.StatusTooManyRequests, "too many failed attempts; try again later")
			return
		}
		s.audit.Record(r.Context(), audit.Entry{
			Action:    "login.failure",
			Target:    body.Email,
			IP:        ip,
			UserAgent: r.UserAgent(),
		})
		writeClientError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}

	csrf, err := auth.NewCSRFToken()
	if err != nil {
		writeServerError(w, r, err)
		return
	}
	http.SetCookie(w, s.buildSessionCookie(session.Token, session.ExpiresAt))
	http.SetCookie(w, s.buildCSRFCookie(csrf, session.ExpiresAt))
	s.audit.Record(r.Context(), audit.Entry{
		Action:    "login.success",
		Target:    session.User.Email,
		IP:        ip,
		UserAgent: r.UserAgent(),
	})
	writeJSON(w, http.StatusOK, model.LoginResponse{OK: true, User: &session.User})
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	token := s.sessionToken(r)
	if session, _ := s.auth.Session(r.Context(), token); session != nil {
		s.audit.Record(r.Context(), audit.Entry{
			Action:    "logout",
			Target:    session.User.Email,
			IP:        clientIP(r),
			UserAgent: r.UserAgent(),
		})
	}
	_ = s.auth.Logout(r.Context(), token)
	http.SetCookie(w, s.buildClearCookie(s.cfg.SessionCookie, true))
	http.SetCookie(w, s.buildClearCookie(s.csrfCookieName(), false))
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// buildSessionCookie centralizes the cookie attributes so login and any future
// reissue (e.g. after change-password) stay in sync. SameSite=Strict because
// admin traffic is always same-site (no cross-site embeds), and Secure is
// driven by COOKIE_SECURE / APP_ORIGIN.
func (s *Server) buildSessionCookie(token string, expires time.Time) *http.Cookie {
	return &http.Cookie{
		Name:     s.cfg.SessionCookie,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
		Secure:   s.cfg.CookieSecure.Resolve(s.cfg.AppOrigin),
		Expires:  expires,
	}
}

// buildCSRFCookie mints the partner cookie used by the double-submit defense.
// Crucially this one is NOT HttpOnly so server-side fetchers (Next route
// handlers / server actions) can lift the value via cookies() and re-attach
// it as the X-CSRF-Token header on outbound calls.
func (s *Server) buildCSRFCookie(token string, expires time.Time) *http.Cookie {
	return &http.Cookie{
		Name:     s.csrfCookieName(),
		Value:    token,
		Path:     "/",
		HttpOnly: false,
		SameSite: http.SameSiteStrictMode,
		Secure:   s.cfg.CookieSecure.Resolve(s.cfg.AppOrigin),
		Expires:  expires,
	}
}

// buildClearCookie produces a cookie that tells the browser to drop the named
// cookie immediately. Attributes mirror their write-side counterparts so the
// browser recognises it as the same cookie and replaces it.
func (s *Server) buildClearCookie(name string, httpOnly bool) *http.Cookie {
	return &http.Cookie{
		Name:     name,
		Value:    "",
		Path:     "/",
		HttpOnly: httpOnly,
		SameSite: http.SameSiteStrictMode,
		Secure:   s.cfg.CookieSecure.Resolve(s.cfg.AppOrigin),
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
	}
}

func (s *Server) handleSession(w http.ResponseWriter, r *http.Request) {
	session, err := s.requireMaybeSession(r.Context(), r)
	if err != nil {
		writeServerError(w, r, err)
		return
	}
	if session == nil {
		writeJSON(w, http.StatusOK, model.SessionResponse{Authenticated: false})
		return
	}
	writeJSON(w, http.StatusOK, model.SessionResponse{Authenticated: true, User: &session.User})
}

// handleAdminChangePassword verifies the current password, writes the new
// bcrypt hash, and revokes every other session for the user. The current
// request keeps its session so the UI does not have to redirect to login.
func (s *Server) handleAdminChangePassword(w http.ResponseWriter, r *http.Request) {
	_, record, user, ok := s.requireAdminRecord(w, r)
	if !ok {
		return
	}
	var body model.ChangePasswordRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4*1024)).Decode(&body); err != nil {
		writeClientError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := s.auth.ChangePassword(r.Context(), user.ID, body.CurrentPassword, body.NewPassword, record.Token); err != nil {
		switch {
		case auth.IsInvalidCredentials(err):
			writeClientError(w, http.StatusUnauthorized, "current password is incorrect")
		case strings.Contains(err.Error(), "at least 8"):
			writeClientError(w, http.StatusBadRequest, "new password must be at least 8 characters")
		default:
			writeServerError(w, r, err)
		}
		return
	}
	uid := user.ID
	s.audit.Record(r.Context(), audit.Entry{
		UserID:    &uid,
		Action:    "password.change",
		Target:    user.Email,
		IP:        clientIP(r),
		UserAgent: r.UserAgent(),
	})
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// handleAdminChangeEmail rotates the admin's email after verifying the
// current password. Existing sessions stay valid because user_id is unchanged.
func (s *Server) handleAdminChangeEmail(w http.ResponseWriter, r *http.Request) {
	_, _, user, ok := s.requireAdminRecord(w, r)
	if !ok {
		return
	}
	var body model.ChangeEmailRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4*1024)).Decode(&body); err != nil {
		writeClientError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := s.auth.ChangeEmail(r.Context(), user.ID, body.CurrentPassword, body.NewEmail); err != nil {
		switch {
		case auth.IsInvalidCredentials(err):
			writeClientError(w, http.StatusUnauthorized, "current password is incorrect")
		case auth.IsInvalidEmail(err):
			writeClientError(w, http.StatusBadRequest, "invalid email address")
		case errors.Is(err, auth.ErrEmailTaken):
			writeClientError(w, http.StatusConflict, "email already in use")
		default:
			writeServerError(w, r, err)
		}
		return
	}
	updated, err := s.auth.Session(r.Context(), s.sessionToken(r))
	if err != nil {
		writeServerError(w, r, err)
		return
	}
	uid := user.ID
	s.audit.Record(r.Context(), audit.Entry{
		UserID:    &uid,
		Action:    "email.change",
		Target:    body.NewEmail,
		IP:        clientIP(r),
		UserAgent: r.UserAgent(),
		Meta:      map[string]any{"oldEmail": user.Email},
	})
	writeJSON(w, http.StatusOK, model.LoginResponse{OK: true, User: optionalUser(updated)})
}

// handleAdminListSessions returns every active session for the current user.
// The "current" flag identifies the row tied to this very request so the UI
// can label it and disable its delete button.
func (s *Server) handleAdminListSessions(w http.ResponseWriter, r *http.Request) {
	_, record, user, ok := s.requireAdminRecord(w, r)
	if !ok {
		return
	}
	rows, err := s.auth.ListSessions(r.Context(), user.ID)
	if err != nil {
		writeServerError(w, r, err)
		return
	}
	out := make([]model.AdminSessionListItem, 0, len(rows))
	for _, row := range rows {
		out = append(out, model.AdminSessionListItem{
			ID:         row.ID.String(),
			IP:         row.IP,
			UserAgent:  row.UserAgent,
			CreatedAt:  row.CreatedAt,
			LastSeenAt: row.LastSeenAt,
			ExpiresAt:  row.ExpiresAt,
			Current:    row.ID == record.ID,
		})
	}
	writeJSON(w, http.StatusOK, out)
}

// handleAdminRevokeSession deletes a single session by id, refusing to delete
// the current request's session (the UI must call /logout for that so the
// cookie is cleared client-side).
func (s *Server) handleAdminRevokeSession(w http.ResponseWriter, r *http.Request) {
	_, record, user, ok := s.requireAdminRecord(w, r)
	if !ok {
		return
	}
	rawID := r.PathValue("id")
	id, err := uuid.Parse(rawID)
	if err != nil {
		writeClientError(w, http.StatusBadRequest, "invalid session id")
		return
	}
	if id == record.ID {
		writeClientError(w, http.StatusBadRequest, "use /v1/admin/logout to end the current session")
		return
	}
	if err := s.auth.RevokeSession(r.Context(), user.ID, id); err != nil {
		if errors.Is(err, auth.ErrSessionNotFound) {
			writeClientError(w, http.StatusNotFound, "session not found")
			return
		}
		writeServerError(w, r, err)
		return
	}
	uid := user.ID
	s.audit.Record(r.Context(), audit.Entry{
		UserID:    &uid,
		Action:    "session.revoke",
		Target:    id.String(),
		IP:        clientIP(r),
		UserAgent: r.UserAgent(),
	})
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// handleAdminRevokeAllOtherSessions kicks every device except this one out.
// Returns the count for the UI's toast message.
func (s *Server) handleAdminRevokeAllOtherSessions(w http.ResponseWriter, r *http.Request) {
	_, record, user, ok := s.requireAdminRecord(w, r)
	if !ok {
		return
	}
	n, err := s.auth.RevokeOtherSessions(r.Context(), user.ID, record.Token)
	if err != nil {
		writeServerError(w, r, err)
		return
	}
	uid := user.ID
	s.audit.Record(r.Context(), audit.Entry{
		UserID:    &uid,
		Action:    "session.revoke_all",
		Target:    user.Email,
		IP:        clientIP(r),
		UserAgent: r.UserAgent(),
		Meta:      map[string]any{"revoked": n},
	})
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "revoked": n})
}

// handleAdminAuditList returns the most recent audit entries (default 50).
// Supports ?action=... and ?before=RFC3339 for keyset pagination.
func (s *Server) handleAdminAuditList(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}
	q := r.URL.Query()
	limit := 50
	if raw := q.Get("limit"); raw != "" {
		if v, err := strconvAtoi(raw); err == nil && v > 0 {
			limit = v
		}
	}
	var before time.Time
	if raw := q.Get("before"); raw != "" {
		if t, err := time.Parse(time.RFC3339, raw); err == nil {
			before = t
		}
	}
	entries, err := s.audit.List(r.Context(), audit.ListFilter{
		Action: q.Get("action"),
		Limit:  limit,
		Before: before,
	})
	if err != nil {
		writeServerError(w, r, err)
		return
	}
	out := make([]model.AdminAuditItem, 0, len(entries))
	for _, e := range entries {
		out = append(out, model.AdminAuditItem{
			ID:        e.ID.String(),
			Action:    e.Action,
			Target:    e.Target,
			IP:        e.IP,
			UserAgent: e.UserAgent,
			Meta:      e.Meta,
			CreatedAt: e.CreatedAt,
		})
	}
	writeJSON(w, http.StatusOK, out)
}

// recordCMSAudit centralizes the audit hook for content writes. We pass the
// session's email through as `target` since the user_id is not loaded on this
// hot path, and the email is enough to identify the actor in the audit list.
func (s *Server) recordCMSAudit(r *http.Request, session *model.Session, action, target string) {
	if session == nil {
		return
	}
	s.audit.Record(r.Context(), audit.Entry{
		Action:    action,
		Target:    target,
		IP:        clientIP(r),
		UserAgent: r.UserAgent(),
		Meta:      map[string]any{"actor": session.User.Email},
	})
}

// strconvAtoi is a tiny ASCII-only int parser so the package keeps its
// existing zero-import preference for trivial helpers.
func strconvAtoi(s string) (int, error) {
	v := 0
	for _, c := range s {
		if c < '0' || c > '9' {
			return 0, errors.New("not a positive int")
		}
		v = v*10 + int(c-'0')
	}
	if s == "" {
		return 0, errors.New("empty")
	}
	return v, nil
}

func optionalUser(s *model.Session) *model.User {
	if s == nil {
		return nil
	}
	user := s.User
	return &user
}

func (s *Server) handleAdminStats(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}
	stats, err := s.content.Stats(r.Context())
	if err != nil {
		writeServerError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, stats)
}

func (s *Server) handleAdminProfileGet(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}
	profile, err := s.content.Profile(r.Context())
	if err != nil {
		writeServerError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, profile)
}

func (s *Server) handleAdminProfilePut(w http.ResponseWriter, r *http.Request) {
	session, ok := s.requireAdmin(w, r)
	if !ok {
		return
	}
	var body model.Profile
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64*1024)).Decode(&body); err != nil {
		writeClientError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	next, err := s.content.UpdateProfile(r.Context(), body)
	if err != nil {
		writeServerError(w, r, err)
		return
	}
	s.invalidatePublicCache()
	s.recordCMSAudit(r, session, "profile.update", body.ID)
	writeJSON(w, http.StatusOK, next)
}

func (s *Server) handleAdminProjects(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}
	items, err := s.content.Projects(r.Context(), true)
	if err != nil {
		writeServerError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (s *Server) handleAdminProjectGet(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}
	item, err := s.content.ProjectByID(r.Context(), r.PathValue("id"))
	if err != nil {
		writeServerError(w, r, err)
		return
	}
	if item == nil {
		writeClientError(w, http.StatusNotFound, "project not found")
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (s *Server) handleAdminProjectCreate(w http.ResponseWriter, r *http.Request) {
	s.handleProjectWrite(w, r, "")
}

func (s *Server) handleAdminProjectUpdate(w http.ResponseWriter, r *http.Request) {
	s.handleProjectWrite(w, r, r.PathValue("id"))
}

func (s *Server) handleProjectWrite(w http.ResponseWriter, r *http.Request, id string) {
	session, ok := s.requireAdmin(w, r)
	if !ok {
		return
	}
	var body model.Project
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 256*1024)).Decode(&body); err != nil {
		writeClientError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if id != "" {
		body.ID = id
	}
	item, err := s.content.UpsertProject(r.Context(), body)
	if err != nil {
		writeServerError(w, r, err)
		return
	}
	s.invalidatePublicCache()
	action := "project.create"
	if id != "" {
		action = "project.update"
	}
	s.recordCMSAudit(r, session, action, item.Slug)
	writeJSON(w, http.StatusOK, item)
}

func (s *Server) handleAdminProjectDelete(w http.ResponseWriter, r *http.Request) {
	session, ok := s.requireAdmin(w, r)
	if !ok {
		return
	}
	id := r.PathValue("id")
	if err := s.content.DeleteProject(r.Context(), id); err != nil {
		writeServerError(w, r, err)
		return
	}
	s.invalidatePublicCache()
	s.recordCMSAudit(r, session, "project.delete", id)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleAdminExperiences(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}
	items, err := s.content.Experiences(r.Context(), true)
	if err != nil {
		writeServerError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (s *Server) handleAdminExperienceGet(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}
	item, err := s.content.ExperienceByID(r.Context(), r.PathValue("id"))
	if err != nil {
		writeServerError(w, r, err)
		return
	}
	if item == nil {
		writeClientError(w, http.StatusNotFound, "experience not found")
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (s *Server) handleAdminExperienceCreate(w http.ResponseWriter, r *http.Request) {
	s.handleExperienceWrite(w, r, "")
}

func (s *Server) handleAdminExperienceUpdate(w http.ResponseWriter, r *http.Request) {
	s.handleExperienceWrite(w, r, r.PathValue("id"))
}

func (s *Server) handleExperienceWrite(w http.ResponseWriter, r *http.Request, id string) {
	session, ok := s.requireAdmin(w, r)
	if !ok {
		return
	}
	var body model.Experience
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 256*1024)).Decode(&body); err != nil {
		writeClientError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if id != "" {
		body.ID = id
	}
	item, err := s.content.UpsertExperience(r.Context(), body)
	if err != nil {
		writeServerError(w, r, err)
		return
	}
	s.invalidatePublicCache()
	action := "experience.create"
	if id != "" {
		action = "experience.update"
	}
	s.recordCMSAudit(r, session, action, item.Slug)
	writeJSON(w, http.StatusOK, item)
}

func (s *Server) handleAdminExperienceDelete(w http.ResponseWriter, r *http.Request) {
	session, ok := s.requireAdmin(w, r)
	if !ok {
		return
	}
	id := r.PathValue("id")
	if err := s.content.DeleteExperience(r.Context(), id); err != nil {
		writeServerError(w, r, err)
		return
	}
	s.invalidatePublicCache()
	s.recordCMSAudit(r, session, "experience.delete", id)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleAdminHonors(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}
	items, err := s.content.Honors(r.Context(), true)
	if err != nil {
		writeServerError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (s *Server) handleAdminHonorGet(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}
	item, err := s.content.HonorByID(r.Context(), r.PathValue("id"))
	if err != nil {
		writeServerError(w, r, err)
		return
	}
	if item == nil {
		writeClientError(w, http.StatusNotFound, "honor not found")
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (s *Server) handleAdminHonorCreate(w http.ResponseWriter, r *http.Request) {
	s.handleHonorWrite(w, r, "")
}

func (s *Server) handleAdminHonorUpdate(w http.ResponseWriter, r *http.Request) {
	s.handleHonorWrite(w, r, r.PathValue("id"))
}

func (s *Server) handleHonorWrite(w http.ResponseWriter, r *http.Request, id string) {
	session, ok := s.requireAdmin(w, r)
	if !ok {
		return
	}
	var body model.Honor
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64*1024)).Decode(&body); err != nil {
		writeClientError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if id != "" {
		body.ID = id
	}
	item, err := s.content.UpsertHonor(r.Context(), body)
	if err != nil {
		writeServerError(w, r, err)
		return
	}
	s.invalidatePublicCache()
	action := "honor.create"
	if id != "" {
		action = "honor.update"
	}
	s.recordCMSAudit(r, session, action, item.ID)
	writeJSON(w, http.StatusOK, item)
}

func (s *Server) handleAdminHonorDelete(w http.ResponseWriter, r *http.Request) {
	session, ok := s.requireAdmin(w, r)
	if !ok {
		return
	}
	id := r.PathValue("id")
	if err := s.content.DeleteHonor(r.Context(), id); err != nil {
		writeServerError(w, r, err)
		return
	}
	s.invalidatePublicCache()
	s.recordCMSAudit(r, session, "honor.delete", id)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleAdminUploadURL(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}
	var body model.MediaUploadRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4*1024)).Decode(&body); err != nil {
		writeClientError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	_, response, err := s.media.CreateUpload(r.Context(), body)
	if err != nil {
		writeClientError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, response)
}

func (s *Server) handleUploadOptions(w http.ResponseWriter, _ *http.Request) {
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleUploadBinary(w http.ResponseWriter, r *http.Request) {
	if !media.IsAllowedMimeType(r.Header.Get("Content-Type")) {
		writeClientError(w, http.StatusUnsupportedMediaType, "unsupported media type")
		return
	}
	max := s.cfg.MediaMaxUploadBytes
	if max <= 0 {
		max = 10 * 1024 * 1024
	}
	limited := http.MaxBytesReader(w, r.Body, max)
	publicURL, err := s.media.StoreUpload(r.Context(), r.PathValue("token"), limited)
	if err != nil {
		// MaxBytesReader surfaces a *http.MaxBytesError on overrun; convert to
		// 413 so the frontend can display a meaningful message.
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			writeClientError(w, http.StatusRequestEntityTooLarge, "file too large")
			return
		}
		writeClientError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"publicUrl": publicURL})
}

func (s *Server) invalidatePublicCache() {
	s.cache.DeletePrefix("public:")
}

func (s *Server) respondCachedJSON(w http.ResponseWriter, r *http.Request, key string, ttl time.Duration, produce func() (any, error)) {
	if cached, ok := s.cache.Get(key); ok {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(cached)
		return
	}
	value, err := produce()
	if err != nil {
		writeServerError(w, r, err)
		return
	}
	body, err := json.Marshal(value)
	if err != nil {
		writeServerError(w, r, err)
		return
	}
	s.cache.Set(key, body, ttl)
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(body)
}

func (s *Server) requireAdmin(w http.ResponseWriter, r *http.Request) (*model.Session, bool) {
	session, err := s.requireMaybeSession(r.Context(), r)
	if err != nil {
		writeServerError(w, r, err)
		return nil, false
	}
	if session == nil {
		writeClientError(w, http.StatusUnauthorized, "unauthorized")
		return nil, false
	}
	return session, true
}

// requireAdminRecord is like requireAdmin but also returns the underlying
// session and user records, which the Phase 2 settings handlers need (to
// know the user UUID and the current session token).
func (s *Server) requireAdminRecord(w http.ResponseWriter, r *http.Request) (*model.Session, *auth.SessionRecord, *auth.UserRecord, bool) {
	session, record, user, err := s.auth.SessionWithRecord(r.Context(), s.sessionToken(r))
	if err != nil {
		writeServerError(w, r, err)
		return nil, nil, nil, false
	}
	if session == nil {
		writeClientError(w, http.StatusUnauthorized, "unauthorized")
		return nil, nil, nil, false
	}
	return session, record, user, true
}

func (s *Server) requireMaybeSession(ctx context.Context, r *http.Request) (*model.Session, error) {
	return s.auth.Session(ctx, s.sessionToken(r))
}

func (s *Server) sessionToken(r *http.Request) string {
	cookie, err := r.Cookie(s.cfg.SessionCookie)
	if err != nil {
		return ""
	}
	return cookie.Value
}

// allowOrLimit checks the limiter for `key`. When the request is over budget it
// writes a 429 with a Retry-After header derived from the limiter window and
// returns false; the handler must early-return in that case.
func (s *Server) allowOrLimit(w http.ResponseWriter, limiter ratelimit.Limiter, key string, window time.Duration) bool {
	if limiter == nil {
		return true
	}
	if limiter.Allow(key) {
		return true
	}
	retryAfter := int(window.Seconds())
	if retryAfter < 1 {
		retryAfter = 1
	}
	w.Header().Set("Retry-After", itoa(retryAfter))
	writeClientError(w, http.StatusTooManyRequests, "rate limit exceeded")
	return false
}

// clientIP extracts the requester IP, taking the first hop of X-Forwarded-For
// when present so the limiter behaves correctly behind a reverse proxy.
func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		if comma := strings.IndexByte(xff, ','); comma > 0 {
			return strings.TrimSpace(xff[:comma])
		}
		return strings.TrimSpace(xff)
	}
	if real := r.Header.Get("X-Real-IP"); real != "" {
		return strings.TrimSpace(real)
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func itoa(v int) string {
	// Tiny helper to avoid pulling in strconv just for one usage.
	if v == 0 {
		return "0"
	}
	negative := v < 0
	if negative {
		v = -v
	}
	digits := []byte{}
	for v > 0 {
		digits = append([]byte{byte('0' + v%10)}, digits...)
		v /= 10
	}
	if negative {
		return "-" + string(digits)
	}
	return string(digits)
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

// writeClientError emits a stable client-facing message for 4xx responses.
// The caller passes a short, safe string that is OK to show to end users.
func writeClientError(w http.ResponseWriter, status int, message string) {
	if message == "" {
		message = http.StatusText(status)
	}
	writeJSON(w, status, map[string]any{
		"ok":      false,
		"message": message,
	})
}

// writeServerError logs the underlying error with the request method/path for
// debugging, but only sends a generic message to the client to avoid leaking
// internal paths, driver errors or stack traces.
func writeServerError(w http.ResponseWriter, r *http.Request, err error) {
	log.Printf("[err] %s %s: %v", r.Method, r.URL.Path, err)
	writeJSON(w, http.StatusInternalServerError, map[string]any{
		"ok":      false,
		"message": "internal error",
	})
}

func Run(ctx context.Context, cfg config.Config) error {
	srv, err := New(ctx, cfg)
	if err != nil {
		return err
	}
	defer srv.Close()

	httpServer := &http.Server{
		Addr:              cfg.Addr,
		Handler:           srv.Handler(),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		// Keep WriteTimeout generous to accommodate long SSE streams;
		// per-handler deadlines should narrow it further when needed.
		WriteTimeout: 5 * time.Minute,
		IdleTimeout:  2 * time.Minute,
	}

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := httpServer.Shutdown(shutdownCtx); err != nil {
			log.Printf("[err] http shutdown: %v", err)
		}
	}()

	go srv.runSessionGC(ctx)

	log.Printf("Go API listening on %s (auth=%s, demo=%t)", cfg.Addr, srv.AuthMode(), srv.ai.DemoMode())
	if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

// runSessionGC purges expired session rows on a 1-hour cadence. The first
// sweep happens immediately on startup so a restart after a long outage does
// not leak stale rows for an hour.
func (s *Server) runSessionGC(ctx context.Context) {
	sweep := func() {
		sweepCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
		defer cancel()
		if n, err := s.auth.PurgeExpired(sweepCtx); err != nil {
			log.Printf("[err] session gc: %v", err)
		} else if n > 0 {
			log.Printf("session gc: purged %d expired session(s)", n)
		}
	}
	sweep()

	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			sweep()
		}
	}
}
