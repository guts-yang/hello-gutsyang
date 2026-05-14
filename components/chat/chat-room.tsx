'use client';

import * as React from 'react';
import { Send, Sparkles } from 'lucide-react';
import { GlassCard } from '@/components/glass-card';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { Locale } from '@/i18n';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

export function ChatRoom({ locale }: { locale: Locale }) {
  const t = useTranslations('sections.ai');
  const [input, setInput] = React.useState('');
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [pending, setPending] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, pending]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || pending) return;

    const next = [...messages, { role: 'user' as const, content: trimmed }];
    setMessages(next);
    setInput('');
    setPending(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: next, locale }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Chat request failed (${res.status})`);
      }

      // Stream text/plain chunks; append to the last assistant message.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistant = '';
      setMessages([...next, { role: 'assistant', content: '' }]);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        assistant += decoder.decode(value, { stream: true });
        setMessages([...next, { role: 'assistant', content: assistant }]);
      }
    } catch (err) {
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
      setPending(false);
    }
  }

  return (
    <GlassCard className="flex h-[70vh] min-h-[480px] flex-col">
      <div className="flex items-center gap-2 border-b border-white/30 dark:border-white/10 pb-4">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-[hsl(var(--accent)/0.15)] text-[hsl(var(--accent))]">
          <Sparkles className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold">{t('title')}</h2>
          <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
        </div>
      </div>

      <div ref={scrollRef} className="scrollbar-none flex-1 space-y-3 overflow-y-auto py-4">
        {messages.length === 0 && (
          <div className="grid h-full place-items-center text-center text-sm text-muted-foreground">
            {t('placeholder')}
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            <div
              className={cn(
                'max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm leading-relaxed',
                m.role === 'user'
                  ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                  : 'border border-white/40 dark:border-white/10 bg-white/50 dark:bg-white/5',
              )}
            >
              {m.content || (pending && i === messages.length - 1 ? t('thinking') : '')}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={send} className="flex items-center gap-2 pt-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('placeholder')}
          className="h-11 flex-1 rounded-full border border-white/40 dark:border-white/10 bg-white/50 dark:bg-white/5 px-4 text-sm outline-none ring-0 transition-colors focus:border-[hsl(var(--primary)/0.5)]"
        />
        <Button type="submit" disabled={pending || !input.trim()}>
          <Send className="h-4 w-4" />
          <span className="sr-only">{t('send')}</span>
        </Button>
      </form>
    </GlassCard>
  );
}
