import { NextRequest } from 'next/server';
import { getBackendInternalBaseUrl } from '@/lib/backend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/ai/sessions is the thin proxy for the visitor's chat history. It
// forwards the anon owner cookie to the Go API and pipes the JSON list back.
// Set-Cookie is forwarded too because the very first sidebar refresh on a new
// browser will mint the owner cookie on this hit.
export async function GET(req: NextRequest) {
  const cookie = req.headers.get('cookie') ?? '';

  let upstream: Response;
  try {
    upstream = await fetch(`${getBackendInternalBaseUrl()}/v1/ai/sessions`, {
      method: 'GET',
      headers: cookie ? { cookie } : {},
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    return Response.json({ ok: false, message: '会话服务暂不可用' }, { status: 504 });
  }

  const headers = new Headers({
    'content-type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  for (const [name, value] of upstream.headers.entries()) {
    if (name.toLowerCase() === 'set-cookie') {
      headers.append('set-cookie', value);
    }
  }
  const body = await upstream.text();
  return new Response(body, { status: upstream.status, headers });
}
