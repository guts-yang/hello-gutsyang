import { NextRequest } from 'next/server';
import { getBackendInternalBaseUrl } from '@/lib/backend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// proxyForwardSetCookie copies any Set-Cookie headers from the upstream
// response onto our outgoing headers so the anonymous owner cookie reaches
// the browser on first contact.
function copySetCookie(headers: Headers, upstream: Response) {
  for (const [name, value] of upstream.headers.entries()) {
    if (name.toLowerCase() === 'set-cookie') {
      headers.append('set-cookie', value);
    }
  }
}

// GET /api/ai/sessions/[id]/messages → JSON transcript for the session.
// The Go backend treats foreign sessions as 404, which we forward as-is so
// the existence of someone else's history is never observable.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const cookie = req.headers.get('cookie') ?? '';

  let upstream: Response;
  try {
    upstream = await fetch(
      `${getBackendInternalBaseUrl()}/v1/ai/sessions/${encodeURIComponent(id)}/messages`,
      {
        method: 'GET',
        headers: cookie ? { cookie } : {},
        cache: 'no-store',
        signal: AbortSignal.timeout(8_000),
      },
    );
  } catch {
    return Response.json({ ok: false, message: '会话服务暂不可用' }, { status: 504 });
  }

  const headers = new Headers({
    'content-type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  copySetCookie(headers, upstream);
  const body = await upstream.text();
  return new Response(body, { status: upstream.status, headers });
}

// DELETE /api/ai/sessions/[id] removes the session and its transcript.
// 404 on foreign ids is preserved.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const cookie = req.headers.get('cookie') ?? '';

  let upstream: Response;
  try {
    upstream = await fetch(
      `${getBackendInternalBaseUrl()}/v1/ai/sessions/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        headers: cookie ? { cookie } : {},
        cache: 'no-store',
        signal: AbortSignal.timeout(8_000),
      },
    );
  } catch {
    return Response.json({ ok: false, message: '会话服务暂不可用' }, { status: 504 });
  }

  const headers = new Headers({
    'content-type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  copySetCookie(headers, upstream);
  const body = await upstream.text();
  return new Response(body, { status: upstream.status, headers });
}
