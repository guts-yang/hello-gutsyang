import { NextRequest } from 'next/server';
import { getBackendInternalBaseUrl } from '@/lib/backend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.text();
  let upstream: Response;
  try {
    upstream = await fetch(`${getBackendInternalBaseUrl()}/v1/admin/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
  } catch (err: unknown) {
    const hint =
      process.env.NODE_ENV === 'development'
        ? '无法连接 Go API。请确认已在另一终端运行 npm run dev:backend，且日志中有 Go API listening on :8081（没有 bind 端口冲突）。'
        : '后端无响应，请稍后再试';
    console.error('[admin/login] upstream failed:', err);
    return Response.json({ ok: false, message: hint }, { status: 504 });
  }

  const headers = new Headers({
    'content-type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  // Forward EVERY Set-Cookie value separately. Using `headers.set` would
  // collapse them into a single header, breaking flows that issue more than
  // one cookie (e.g. session + refresh + CSRF tokens).
  for (const cookie of upstream.headers.getSetCookie()) {
    headers.append('set-cookie', cookie);
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}
