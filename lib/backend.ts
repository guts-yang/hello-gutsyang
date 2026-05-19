import 'server-only';

import { cookies } from 'next/headers';

type BackendFetchOptions = {
  auth?: boolean;
  revalidate?: number | false;
  /**
   * Maximum time to wait for the upstream response in milliseconds.
   * Defaults to 8 seconds; pass `false` to opt out (used for streaming routes
   * like SSE chat or long-running PDF generation).
   */
  timeoutMs?: number | false;
};

export const DEFAULT_BACKEND_TIMEOUT_MS = 8_000;

function trimTrailingSlash(value: string) {
  return value.replace(/\/$/, '');
}

export function isBackendConfigured() {
  return Boolean(process.env.GO_API_URL || process.env.GO_API_INTERNAL_URL);
}

export function getBackendPublicBaseUrl() {
  return trimTrailingSlash(process.env.GO_API_URL || 'http://localhost:8081');
}

export function getBackendInternalBaseUrl() {
  return trimTrailingSlash(process.env.GO_API_INTERNAL_URL || process.env.GO_API_URL || 'http://127.0.0.1:8081');
}

export async function getBackendCookieHeader() {
  const cookieStore = await cookies();
  return cookieStore
    .getAll()
    .map((entry) => `${entry.name}=${entry.value}`)
    .join('; ');
}

// getCSRFCookieName mirrors the Go side: <sessionCookie>_csrf where
// sessionCookie comes from ADMIN_SESSION_COOKIE (same default both sides).
function getCSRFCookieName() {
  const base = process.env.ADMIN_SESSION_COOKIE || 'hello_gutsyang_admin_session';
  return `${base}_csrf`;
}

// getCSRFToken reads the double-submit cookie that the Go login handler set on
// the browser. Returns the empty string when there is no cookie, in which
// case the upstream POST will get a 403 — that is the correct behaviour for
// "session went away mid-flight".
export async function getCSRFToken() {
  const cookieStore = await cookies();
  return cookieStore.get(getCSRFCookieName())?.value ?? '';
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export async function fetchBackend(path: string, init: RequestInit = {}, options: BackendFetchOptions = {}) {
  const headers = new Headers(init.headers);
  if (options.auth) {
    const cookieHeader = await getBackendCookieHeader();
    if (cookieHeader) headers.set('cookie', cookieHeader);

    const method = (init.method ?? 'GET').toUpperCase();
    if (MUTATING_METHODS.has(method) && !headers.has('x-csrf-token')) {
      const csrf = await getCSRFToken();
      if (csrf) headers.set('x-csrf-token', csrf);
    }
  }

  const next =
    options.revalidate === false
      ? undefined
      : { revalidate: options.revalidate ?? 60 };

  // Bound the upstream call so a hung Go API never pins a Server Component or
  // middleware indefinitely. Caller-supplied AbortSignal still wins via the
  // standard `init.signal` channel; otherwise we apply the default timeout.
  const signal = resolveSignal(init.signal ?? null, options.timeoutMs);

  return fetch(`${getBackendInternalBaseUrl()}${path}`, {
    ...init,
    headers,
    signal,
    cache: options.revalidate === false ? 'no-store' : init.cache,
    next,
  });
}

export async function fetchBackendJson<T>(path: string, init: RequestInit = {}, options: BackendFetchOptions = {}) {
  const response = await fetchBackend(path, init, options);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `Backend request failed (${response.status})`);
  }
  return (await response.json()) as T;
}

function resolveSignal(callerSignal: AbortSignal | null, timeoutMs: number | false | undefined): AbortSignal | undefined {
  if (callerSignal) return callerSignal;
  if (timeoutMs === false) return undefined;
  const ms = timeoutMs ?? DEFAULT_BACKEND_TIMEOUT_MS;
  return AbortSignal.timeout(ms);
}
