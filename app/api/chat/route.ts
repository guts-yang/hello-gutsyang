import { NextRequest } from 'next/server';
import { getBackendInternalBaseUrl } from '@/lib/backend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.text();
  let upstream: Response;
  try {
    upstream = await fetch(`${getBackendInternalBaseUrl()}/v1/ai/chat`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
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

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') || 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
