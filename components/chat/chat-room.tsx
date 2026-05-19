'use client';

import * as React from 'react';
import { Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { Locale } from '@/i18n';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

/**
 * Pure chat surface. Layout is owned by the parent (popover, bottom sheet,
 * full page) — pass `className` for sizing and `variant="bare"` to drop the
 * outer glass card so the parent panel provides the chrome.
 *
 * Session model: when the parent passes a `sessionId`, the room scopes its
 * conversation to that session. Switching to a new id resets the visible
 * transcript to `initialMessages` (typically replayed from the API). The
 * parent learns about new sessions via `onSessionResolved`, which fires after
 * the streaming response surfaces the X-Chat-Session-Id header — this lets
 * the sidebar refresh and select the just-created session without the chat
 * room knowing how the sidebar is rendered.
 */
export function ChatRoom({
  locale,
  className,
  variant = 'card',
  sessionId = null,
  initialMessages,
  onSessionResolved,
}: {
  locale: Locale;
  className?: string;
  variant?: 'card' | 'bare';
  sessionId?: string | null;
  initialMessages?: ChatMessage[];
  onSessionResolved?: (sessionId: string) => void;
}) {
  const t = useTranslations('sections.ai');
  const [input, setInput] = React.useState('');
  const [messages, setMessages] = React.useState<ChatMessage[]>(initialMessages ?? []);
  const [draft, setDraft] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const draftRef = React.useRef('');
  const flushTimerRef = React.useRef<number | null>(null);
  const nextMessagesRef = React.useRef<ChatMessage[]>([]);

  // Reset visible transcript whenever the parent switches the active session
  // (including the "new chat" → sessionId=null reset).
  React.useEffect(() => {
    setMessages(initialMessages ?? []);
    setDraft('');
    draftRef.current = '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: pending ? 'auto' : 'smooth',
    });
  }, [messages.length, draft, pending]);

  React.useEffect(() => {
    return () => {
      if (flushTimerRef.current) {
        window.clearTimeout(flushTimerRef.current);
      }
    };
  }, []);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || pending) return;

    const next = [...messages, { role: 'user' as const, content: trimmed }];
    setMessages(next);
    nextMessagesRef.current = next;
    setInput('');
    setDraft('');
    draftRef.current = '';
    setPending(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: next,
          locale,
          ...(sessionId ? { sessionId } : {}),
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Chat request failed (${res.status})`);
      }

      // Surface the session id to the parent before draining the stream so
      // the sidebar can already insert the new row optimistically.
      const resolved = res.headers.get('X-Chat-Session-Id');
      if (resolved && resolved !== sessionId) {
        onSessionResolved?.(resolved);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      setDraft('');

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        draftRef.current += decoder.decode(value, { stream: true });
        if (flushTimerRef.current == null) {
          flushTimerRef.current = window.setTimeout(() => {
            flushTimerRef.current = null;
            setDraft(draftRef.current);
          }, 60);
        }
      }

      if (flushTimerRef.current) {
        window.clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      const assistant = draftRef.current;
      setDraft('');
      setMessages([...nextMessagesRef.current, { role: 'assistant', content: assistant }]);
    } catch {
      setMessages([
        ...next,
        {
          role: 'assistant',
          content:
            locale === 'zh'
              ? '抱歉，AI 助手暂时不可用，请稍后再试。'
              : 'Sorry, the AI assistant is temporarily unavailable. Please try again later.',
        },
      ]);
    } finally {
      draftRef.current = '';
      setPending(false);
    }
  }

  const wrapperClass =
    variant === 'card'
      ? cn('glass relative flex flex-col rounded-3xl p-6 sm:p-7', className)
      : cn('flex h-full w-full flex-col', className);

  return (
    <div className={wrapperClass}>
      {variant === 'card' && (
        <div className="flex items-center gap-2 border-b border-white/30 dark:border-white/10 pb-4">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[hsl(var(--accent)/0.15)] text-[hsl(var(--accent))]">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold">{t('title')}</h2>
            <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
          </div>
        </div>
      )}

      <div
        ref={scrollRef}
        className="scrollbar-none flex-1 space-y-3 overflow-y-auto px-1 py-3"
      >
        {messages.length === 0 && !pending && (
          <div className="grid h-full place-items-center px-4 text-center text-sm text-muted-foreground">
            {t('placeholder')}
          </div>
        )}
        {[...messages, ...(pending && draft ? [{ role: 'assistant', content: draft } as ChatMessage] : [])].map((m, i) => (
          <div
            key={i}
            className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            <div
              className={cn(
                'max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm leading-relaxed',
                m.role === 'user'
                  ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                  : 'border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5',
              )}
            >
              {m.content || (pending && i === messages.length - 1 ? t('thinking') : '')}
            </div>
          </div>
        ))}
        {pending && !draft && messages.length > 0 && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-muted-foreground dark:border-white/10 dark:bg-white/5">
              {t('thinking')}
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={send}
        className="flex items-center gap-2 border-t border-slate-200 pt-3 dark:border-white/10"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('placeholder')}
          className="h-11 flex-1 rounded-full border border-slate-200 bg-white px-4 text-sm outline-none ring-0 transition-colors focus:border-[hsl(var(--primary)/0.5)] dark:border-white/10 dark:bg-white/5"
        />
        <Button type="submit" disabled={pending || !input.trim()} size="icon">
          <Send className="h-4 w-4" />
          <span className="sr-only">{t('send')}</span>
        </Button>
      </form>
    </div>
  );
}
