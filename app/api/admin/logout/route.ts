import { getBackendCookieHeader, getBackendInternalBaseUrl, getCSRFToken } from '@/lib/backend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  // Logout is a CSRF-protected mutation on the Go side. The csrf cookie was
  // set at login time and is automatically forwarded through the cookie
  // header below; we additionally lift it out and re-send as the
  // X-CSRF-Token header to satisfy the double-submit middleware.
  const csrf = await getCSRFToken();
  const upstreamHeaders: Record<string, string> = {
    cookie: await getBackendCookieHeader(),
  };
  if (csrf) upstreamHeaders['x-csrf-token'] = csrf;

  let upstream: Response;
  try {
    upstream = await fetch(`${getBackendInternalBaseUrl()}/v1/admin/logout`, {
      method: 'POST',
      headers: upstreamHeaders,
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    return Response.json({ ok: false, message: '后端无响应，请稍后再试' }, { status: 504 });
  }

  const headers = new Headers({
    'content-type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  for (const cookie of upstream.headers.getSetCookie()) {
    headers.append('set-cookie', cookie);
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}
