import { NextRequest } from 'next/server';
import { fetchBackend } from '@/lib/backend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/admin/ai/translate proxies the admin-only DeepSeek translation
// call. We hand off to fetchBackend so the admin session cookie + CSRF
// double-submit token are attached automatically (the browser already has
// both cookies because the admin is logged in to /admin).
export async function POST(req: NextRequest) {
  const body = await req.text();

  let upstream: Response;
  try {
    upstream = await fetchBackend(
      '/v1/admin/ai/translate',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      },
      { auth: true, revalidate: false, timeoutMs: 30_000 },
    );
  } catch {
    return Response.json({ ok: false, message: '翻译服务暂不可用' }, { status: 504 });
  }

  const headers = new Headers({
    'content-type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  const text = await upstream.text();
  return new Response(text, { status: upstream.status, headers });
}
