package server

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/url"
	"sync"
	"testing"
	"time"

	"golang.org/x/crypto/bcrypt"

	"github.com/guts-yang/hello-gutsyang/backend/internal/config"
	"github.com/guts-yang/hello-gutsyang/backend/internal/model"
)

// adminCookie / csrfCookie are the names buildSessionCookie / buildCSRFCookie
// emit when SessionCookie below is set. Pulled out so the test reads more
// like the expected HTTP traffic.
const (
	testSessionCookie    = "test_admin_session"
	testCSRFCookie       = "test_admin_session_csrf"
	testChatOwnerCookie  = "test_chat_owner"
)

// newTestServer wires server.New() in the in-memory fallback path (no
// DATABASE_URL) with an admin pre-bootstrapped via env hash. Returned
// httptest.Server uses the full middleware stack — same code path as prod —
// and an http.Client with cookiejar so tests act like a real browser.
func newTestServer(t *testing.T) (*httptest.Server, *http.Client, string) {
	t.Helper()

	plain := "right-passw0rd"
	hash, err := bcrypt.GenerateFromPassword([]byte(plain), bcrypt.MinCost)
	if err != nil {
		t.Fatalf("seed hash: %v", err)
	}

	cfg := config.Config{
		Addr:                ":0",
		PublicBaseURL:       "http://test",
		AppOrigin:           "http://localhost:3000",
		AllowedOrigins:      []string{"http://localhost:3000"},
		DataDir:             t.TempDir(),
		AdminEmail:          "tony@example.com",
		AdminPasswordHash:   string(hash),
		DeepSeekModel:       "deepseek-v4-flash",
		SessionCookie:       testSessionCookie,
		CookieSecure:        config.CookieSecureOff,
		MediaMaxUploadBytes: 4 * 1024 * 1024,
		ChatOwnerCookie:     testChatOwnerCookie,
		RateLimitLogin:      config.RateLimitConfig{Burst: 1000, Window: time.Minute},
		RateLimitChat:       config.RateLimitConfig{Burst: 1000, Window: time.Minute},
		RateLimitAIList:     config.RateLimitConfig{Burst: 1000, Window: time.Minute},
		LoginLockout: config.LockoutConfig{
			Threshold: 3,
			Window:    time.Minute,
			BlockFor:  time.Minute,
		},
	}

	srv, err := New(context.Background(), cfg)
	if err != nil {
		t.Fatalf("server.New: %v", err)
	}
	t.Cleanup(srv.Close)

	ts := httptest.NewServer(srv.Handler())
	t.Cleanup(ts.Close)

	jar, err := cookiejar.New(nil)
	if err != nil {
		t.Fatalf("cookiejar: %v", err)
	}
	client := &http.Client{Jar: jar, Timeout: 5 * time.Second}
	return ts, client, plain
}

// loginAsTony performs the standard login with the seeded credentials and
// asserts the response includes both cookies. Returns the csrf token so
// follow-up mutations can drop it into the X-CSRF-Token header.
func loginAsTony(t *testing.T, ts *httptest.Server, client *http.Client, password string) string {
	t.Helper()
	body, _ := json.Marshal(model.LoginRequest{Email: "tony@example.com", Password: password})
	req, _ := http.NewRequest("POST", ts.URL+"/v1/admin/login", bytes.NewReader(body))
	req.Header.Set("content-type", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("login: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		text, _ := io.ReadAll(resp.Body)
		t.Fatalf("login expected 200, got %d: %s", resp.StatusCode, text)
	}

	var sessionCookie, csrfCookie string
	for _, c := range resp.Cookies() {
		switch c.Name {
		case testSessionCookie:
			sessionCookie = c.Value
		case testCSRFCookie:
			csrfCookie = c.Value
		}
	}
	if sessionCookie == "" || csrfCookie == "" {
		t.Fatalf("login should set both cookies; got session=%q csrf=%q", sessionCookie, csrfCookie)
	}
	return csrfCookie
}

func TestE2E_LoginCSRFChangePasswordChangeEmailAuditChain(t *testing.T) {
	t.Parallel()
	ts, client, plain := newTestServer(t)

	csrf := loginAsTony(t, ts, client, plain)

	// 1. Without X-CSRF-Token header, mutations are blocked even though the
	// session cookie is valid.
	req, _ := http.NewRequest("POST", ts.URL+"/v1/admin/sessions/revoke-all", nil)
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("revoke-all without csrf: %v", err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("missing csrf should be 403, got %d", resp.StatusCode)
	}

	// 2. Change password with valid CSRF — succeeds and revokes all OTHER
	// sessions; current session keeps working.
	pwBody, _ := json.Marshal(model.ChangePasswordRequest{
		CurrentPassword: plain,
		NewPassword:     "new-strongerpassw0rd",
	})
	req, _ = http.NewRequest("POST", ts.URL+"/v1/admin/password", bytes.NewReader(pwBody))
	req.Header.Set("content-type", "application/json")
	req.Header.Set("X-CSRF-Token", csrf)
	resp, err = client.Do(req)
	if err != nil {
		t.Fatalf("change password: %v", err)
	}
	if resp.StatusCode != 200 {
		text, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		t.Fatalf("change password expected 200, got %d: %s", resp.StatusCode, text)
	}
	resp.Body.Close()

	// 3. Old password no longer works (use a fresh client without cookies).
	freshJar, _ := cookiejar.New(nil)
	freshClient := &http.Client{Jar: freshJar, Timeout: 5 * time.Second}
	body, _ := json.Marshal(model.LoginRequest{Email: "tony@example.com", Password: plain})
	req, _ = http.NewRequest("POST", ts.URL+"/v1/admin/login", bytes.NewReader(body))
	req.Header.Set("content-type", "application/json")
	resp, err = freshClient.Do(req)
	if err != nil {
		t.Fatalf("login old password: %v", err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("old password should now be 401, got %d", resp.StatusCode)
	}

	// 4. Current session (the original client) still works — the password
	// change kept the request's own session alive.
	resp, err = client.Get(ts.URL + "/v1/admin/session")
	if err != nil {
		t.Fatalf("session check: %v", err)
	}
	var status model.SessionResponse
	_ = json.NewDecoder(resp.Body).Decode(&status)
	resp.Body.Close()
	if !status.Authenticated {
		t.Fatalf("current session should remain authenticated after password change")
	}

	// 5. Change email with the new password and CSRF still valid.
	emailBody, _ := json.Marshal(model.ChangeEmailRequest{
		CurrentPassword: "new-strongerpassw0rd",
		NewEmail:        "tony2@example.com",
	})
	req, _ = http.NewRequest("PUT", ts.URL+"/v1/admin/email", bytes.NewReader(emailBody))
	req.Header.Set("content-type", "application/json")
	req.Header.Set("X-CSRF-Token", csrf)
	resp, err = client.Do(req)
	if err != nil {
		t.Fatalf("change email: %v", err)
	}
	if resp.StatusCode != 200 {
		text, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		t.Fatalf("change email expected 200, got %d: %s", resp.StatusCode, text)
	}
	resp.Body.Close()

	// 6. Audit log contains 1 login.success + 1 password.change + 1 email.change.
	resp, err = client.Get(ts.URL + "/v1/admin/audit")
	if err != nil {
		t.Fatalf("audit list: %v", err)
	}
	if resp.StatusCode != 200 {
		text, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		t.Fatalf("audit list expected 200, got %d: %s", resp.StatusCode, text)
	}
	var entries []model.AdminAuditItem
	if err := json.NewDecoder(resp.Body).Decode(&entries); err != nil {
		t.Fatalf("audit decode: %v", err)
	}
	resp.Body.Close()

	want := map[string]bool{"login.success": false, "password.change": false, "email.change": false}
	for _, e := range entries {
		if _, ok := want[e.Action]; ok {
			want[e.Action] = true
		}
	}
	for action, found := range want {
		if !found {
			t.Fatalf("audit log missing action %q (got %d entries)", action, len(entries))
		}
	}

	// 7. Failed login from elsewhere also gets audited so attacks are visible.
	body, _ = json.Marshal(model.LoginRequest{Email: "tony2@example.com", Password: "wrong"})
	req, _ = http.NewRequest("POST", ts.URL+"/v1/admin/login", bytes.NewReader(body))
	req.Header.Set("content-type", "application/json")
	resp, err = freshClient.Do(req)
	if err != nil {
		t.Fatalf("bad login: %v", err)
	}
	resp.Body.Close()

	resp, err = client.Get(ts.URL + "/v1/admin/audit?action=login.failure")
	if err != nil {
		t.Fatalf("audit filter: %v", err)
	}
	var failures []model.AdminAuditItem
	_ = json.NewDecoder(resp.Body).Decode(&failures)
	resp.Body.Close()
	if len(failures) == 0 {
		t.Fatalf("expected at least one login.failure entry")
	}
}

func TestE2E_LoginLockoutAfterRepeatedFailures(t *testing.T) {
	t.Parallel()
	ts, _, _ := newTestServer(t)

	// Concurrently drive 3 wrong-password requests + 1 right-password request
	// from the same IP. With Lockout.Threshold=3 the right-password attempt
	// should be denied with 429 once the bad ones have been recorded.
	var wg sync.WaitGroup
	for i := 0; i < 3; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			body, _ := json.Marshal(model.LoginRequest{
				Email:    "tony@example.com",
				Password: fmt.Sprintf("wrong-%d", i),
			})
			http.Post(ts.URL+"/v1/admin/login", "application/json", bytes.NewReader(body))
		}(i)
	}
	wg.Wait()

	// Now hit with a 4th attempt. After 3 failures within the window the
	// counter should trip regardless of whether this attempt's password is
	// right (lockout precedes the credential check).
	body, _ := json.Marshal(model.LoginRequest{
		Email:    "tony@example.com",
		Password: "right-passw0rd",
	})
	resp, err := http.Post(ts.URL+"/v1/admin/login", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatalf("login: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusTooManyRequests {
		text, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 429 after lockout, got %d: %s", resp.StatusCode, text)
	}
	if resp.Header.Get("Retry-After") == "" {
		t.Fatalf("expected Retry-After header on lockout")
	}
}

// TestE2E_ChatSessionLifecycle exercises the visitor-facing chat persistence:
// anonymous cookie minting, transcript storage, resuming an existing session,
// starting a fresh one, deletion, and cross-owner isolation. The Go AI service
// runs in demo mode (DEEPSEEK_API_KEY is unset in the fixture) so the upstream
// stream is a canned string — but the persistence path is identical to prod.
func TestE2E_ChatSessionLifecycle(t *testing.T) {
	t.Parallel()
	ts, clientA, _ := newTestServer(t)
	tsURL := mustParseURL(t, ts.URL)

	// Step 1: First POST mints the anon cookie, creates a session, returns
	// the session id in a response header, and streams the demo reply back.
	first := postChat(t, ts, clientA, map[string]any{
		"locale": "zh",
		"messages": []map[string]string{
			{"role": "user", "content": "你最硬核的项目是什么？"},
		},
	})
	if first.sessionID == "" {
		t.Fatalf("missing X-Chat-Session-Id on first chat")
	}
	if len(first.body) == 0 {
		t.Fatalf("empty stream body")
	}
	cookieFound := false
	for _, c := range clientA.Jar.Cookies(tsURL) {
		if c.Name == testChatOwnerCookie {
			cookieFound = true
			break
		}
	}
	if !cookieFound {
		t.Fatalf("chat owner cookie not set on first request")
	}

	// Step 2: GET sessions returns the one we just created.
	sessions := getSessions(t, ts, clientA)
	if len(sessions) != 1 {
		t.Fatalf("want 1 session, got %d", len(sessions))
	}
	if sessions[0].ID != first.sessionID {
		t.Fatalf("session id mismatch: list=%s header=%s", sessions[0].ID, first.sessionID)
	}

	// Step 3: GET messages returns user + assistant. The demo handler stores
	// the canned reply as the assistant turn.
	msgs := getMessages(t, ts, clientA, first.sessionID)
	if len(msgs) != 2 {
		t.Fatalf("want 2 messages, got %d", len(msgs))
	}
	if msgs[0].Role != "user" || msgs[1].Role != "assistant" {
		t.Fatalf("unexpected role ordering: %v", msgs)
	}

	// Step 4: Sending again with the same sessionId resumes the same row;
	// the transcript grows.
	second := postChat(t, ts, clientA, map[string]any{
		"locale":    "zh",
		"sessionId": first.sessionID,
		"messages": []map[string]string{
			{"role": "user", "content": "你最硬核的项目是什么？"},
			{"role": "assistant", "content": string(first.body)},
			{"role": "user", "content": "再多说点细节"},
		},
	})
	if second.sessionID != first.sessionID {
		t.Fatalf("expected same session id on resume, got %s", second.sessionID)
	}
	if got := getSessions(t, ts, clientA); len(got) != 1 {
		t.Fatalf("still want 1 session after resume, got %d", len(got))
	}
	if got := getMessages(t, ts, clientA, first.sessionID); len(got) != 4 {
		t.Fatalf("want 4 messages after resume, got %d", len(got))
	}

	// Step 5: Omitting sessionId opens a new conversation.
	third := postChat(t, ts, clientA, map[string]any{
		"locale": "en",
		"messages": []map[string]string{
			{"role": "user", "content": "what is his strongest skill?"},
		},
	})
	if third.sessionID == "" || third.sessionID == first.sessionID {
		t.Fatalf("expected a fresh session id, got %q", third.sessionID)
	}
	if got := getSessions(t, ts, clientA); len(got) != 2 {
		t.Fatalf("want 2 sessions after fresh chat, got %d", len(got))
	}

	// Step 6: DELETE the first session removes it from the list.
	req, _ := http.NewRequest("DELETE", ts.URL+"/v1/ai/sessions/"+first.sessionID, nil)
	resp, err := clientA.Do(req)
	if err != nil {
		t.Fatalf("delete: %v", err)
	}
	resp.Body.Close()
	if resp.StatusCode != 200 {
		t.Fatalf("delete expected 200, got %d", resp.StatusCode)
	}
	remaining := getSessions(t, ts, clientA)
	if len(remaining) != 1 {
		t.Fatalf("after delete want 1 session, got %d", len(remaining))
	}
	if remaining[0].ID != third.sessionID {
		t.Fatalf("wrong remaining session: %s vs %s", remaining[0].ID, third.sessionID)
	}

	// Step 7: A different visitor (separate cookie jar) cannot see or read
	// clientA's session. The list endpoint returns the fresh visitor's own
	// (empty) list, and reading a foreign session id returns 404.
	jarB, _ := cookiejar.New(nil)
	clientB := &http.Client{Jar: jarB, Timeout: 5 * time.Second}
	_ = postChat(t, ts, clientB, map[string]any{
		"locale":   "en",
		"messages": []map[string]string{{"role": "user", "content": "hi"}},
	})
	resp, err = clientB.Get(ts.URL + "/v1/ai/sessions/" + third.sessionID + "/messages")
	if err != nil {
		t.Fatalf("clientB foreign get: %v", err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("foreign session should be 404, got %d", resp.StatusCode)
	}
	sessionsB := getSessions(t, ts, clientB)
	if len(sessionsB) != 1 {
		t.Fatalf("clientB should only see its own session, got %d", len(sessionsB))
	}
}

// chatResult bundles the streamed body and the resolved session id so chained
// asserts read like the diary of a single conversation rather than a tangle
// of header lookups.
type chatResult struct {
	body      []byte
	sessionID string
}

func postChat(t *testing.T, ts *httptest.Server, client *http.Client, body map[string]any) chatResult {
	t.Helper()
	raw, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal chat body: %v", err)
	}
	req, _ := http.NewRequest("POST", ts.URL+"/v1/ai/chat", bytes.NewReader(raw))
	req.Header.Set("content-type", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("chat: %v", err)
	}
	defer resp.Body.Close()
	stream, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		t.Fatalf("chat expected 200, got %d: %s", resp.StatusCode, stream)
	}
	return chatResult{body: stream, sessionID: resp.Header.Get("X-Chat-Session-Id")}
}

func getSessions(t *testing.T, ts *httptest.Server, client *http.Client) []model.ChatSessionItem {
	t.Helper()
	resp, err := client.Get(ts.URL + "/v1/ai/sessions")
	if err != nil {
		t.Fatalf("get sessions: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		text, _ := io.ReadAll(resp.Body)
		t.Fatalf("get sessions expected 200, got %d: %s", resp.StatusCode, text)
	}
	var out []model.ChatSessionItem
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		t.Fatalf("decode sessions: %v", err)
	}
	return out
}

func getMessages(t *testing.T, ts *httptest.Server, client *http.Client, id string) []model.ChatMessageItem {
	t.Helper()
	resp, err := client.Get(ts.URL + "/v1/ai/sessions/" + id + "/messages")
	if err != nil {
		t.Fatalf("get messages: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		text, _ := io.ReadAll(resp.Body)
		t.Fatalf("get messages expected 200, got %d: %s", resp.StatusCode, text)
	}
	var out []model.ChatMessageItem
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		t.Fatalf("decode messages: %v", err)
	}
	return out
}

func mustParseURL(t *testing.T, raw string) *url.URL {
	t.Helper()
	u, err := url.Parse(raw)
	if err != nil {
		t.Fatalf("parse %q: %v", raw, err)
	}
	return u
}

func TestE2E_RevokeOtherSessions(t *testing.T) {
	t.Parallel()
	ts, clientA, plain := newTestServer(t)

	csrfA := loginAsTony(t, ts, clientA, plain)

	// Second device: separate cookie jar, fresh login → distinct session.
	jarB, _ := cookiejar.New(nil)
	clientB := &http.Client{Jar: jarB, Timeout: 5 * time.Second}
	_ = loginAsTony(t, ts, clientB, plain)

	// First device kicks the others.
	req, _ := http.NewRequest("POST", ts.URL+"/v1/admin/sessions/revoke-all", nil)
	req.Header.Set("X-CSRF-Token", csrfA)
	resp, err := clientA.Do(req)
	if err != nil {
		t.Fatalf("revoke-all: %v", err)
	}
	resp.Body.Close()
	if resp.StatusCode != 200 {
		t.Fatalf("revoke-all expected 200, got %d", resp.StatusCode)
	}

	// Device A is still authenticated.
	resp, err = clientA.Get(ts.URL + "/v1/admin/session")
	if err != nil {
		t.Fatalf("clientA session: %v", err)
	}
	var sa model.SessionResponse
	_ = json.NewDecoder(resp.Body).Decode(&sa)
	resp.Body.Close()
	if !sa.Authenticated {
		t.Fatalf("device A should still be authenticated")
	}

	// Device B has been kicked.
	resp, err = clientB.Get(ts.URL + "/v1/admin/session")
	if err != nil {
		t.Fatalf("clientB session: %v", err)
	}
	var sb model.SessionResponse
	_ = json.NewDecoder(resp.Body).Decode(&sb)
	resp.Body.Close()
	if sb.Authenticated {
		t.Fatalf("device B should be revoked")
	}
}
