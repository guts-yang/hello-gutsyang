import { NextRequest } from 'next/server';
import { buildSystemPrompt } from '@/lib/ai/system-prompt';
import type { Locale } from '@/i18n';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };

export async function POST(req: NextRequest) {
  let body: { messages?: ChatMessage[]; locale?: Locale } = {};
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const messages = (body.messages ?? []).filter((m) => m.role !== 'system');
  if (messages.length === 0) return new Response('Empty conversation', { status: 400 });

  const locale: Locale = body.locale === 'en' ? 'en' : 'zh';
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

  if (!apiKey) {
    // Friendly mock so the UI works without a key during development.
    const mock =
      locale === 'zh'
        ? '（演示模式）请在 .env.local 配置 DEEPSEEK_API_KEY 后再试。\n\n示例回答：他的核心方向是大模型机器遗忘学习与多智能体架构。'
        : '(Demo mode) Set DEEPSEEK_API_KEY in .env.local to enable live answers.\n\nExample: His focus is LLM machine unlearning and multi-agent orchestration.';
    return streamText(mock);
  }

  const systemPrompt = await buildSystemPrompt(locale);

  const upstream = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      stream: true,
      temperature: 0.6,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => '');
    return new Response(`Upstream error: ${upstream.status} ${text.slice(0, 200)}`, { status: 502 });
  }

  // Parse OpenAI-compatible SSE and re-emit plain text deltas to the client.
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffered = '';
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffered += decoder.decode(value, { stream: true });
          // SSE messages are separated by \n\n
          let idx;
          while ((idx = buffered.indexOf('\n\n')) >= 0) {
            const event = buffered.slice(0, idx).trim();
            buffered = buffered.slice(idx + 2);
            if (!event) continue;
            for (const line of event.split('\n')) {
              if (!line.startsWith('data:')) continue;
              const payload = line.slice(5).trim();
              if (payload === '[DONE]') {
                controller.close();
                return;
              }
              try {
                const json = JSON.parse(payload);
                const delta: string | undefined = json?.choices?.[0]?.delta?.content;
                if (delta) controller.enqueue(encoder.encode(delta));
              } catch {
                // ignore malformed chunk
              }
            }
          }
        }
      } catch (err) {
        controller.error(err);
        return;
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function streamText(text: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const chunks = text.match(/.{1,8}/gs) ?? [text];
      for (const c of chunks) {
        controller.enqueue(encoder.encode(c));
        await new Promise((r) => setTimeout(r, 20));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });
}
