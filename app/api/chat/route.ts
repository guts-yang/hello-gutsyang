import { NextRequest } from 'next/server';
import { getBackendInternalBaseUrl } from '@/lib/backend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/chat is the streaming SSE relay between the browser and the Go AI
// service. Body is forwarded verbatim; we also bridge the anonymous chat
// owner cookie (so the visitor's persisted history follows them) and surface
// the X-Chat-Session-Id header so the client can record the new/updated
// session id without parsing the streamed body.
export async function POST(req: NextRequest) {
  const body = await req.text();
  const cookie = req.headers.get('cookie') ?? '';

  let upstream: Response;
  try {
    upstream = await fetch(`${getBackendInternalBaseUrl()}/v1/ai/chat`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(cookie ? { cookie } : {}),
      },
      body,
      cache: 'no-store',
      // 60s budget covers the upstream DeepSeek streaming session. Tighter
      // protection lives inside the Go API (per-IP rate limit + handler ctx
      // cancellation), so this is a coarse blackhole guard rather than a
      // per-token deadline.
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    return Response.json({ ok: false, message: 'AI 服务暂不可用，请稍后再试' }, { status: 504 });
  }

  const headers = new Headers({
    'content-type': upstream.headers.get('content-type') || 'text/plain; charset=utf-8',
    'cache-control': 'no-store',
  });
  // Surface the session id so the client can switch the active session
  // without re-fetching the list.
  const sessionId = upstream.headers.get('X-Chat-Session-Id');
  if (sessionId) {
    headers.set('X-Chat-Session-Id', sessionId);
  }
  // Forward Set-Cookie verbatim so the anon owner cookie is minted on the
  // visitor's browser the very first time they chat.
  for (const [name, value] of upstream.headers.entries()) {
    if (name.toLowerCase() === 'set-cookie') {
      headers.append('set-cookie', value);
    }
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}
