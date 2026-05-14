'use client';

import * as React from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Sparkles, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { GlassCard } from '@/components/glass-card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function AiChatCard({ className }: { className?: string }) {
  const t = useTranslations('sections.ai');
  const locale = useLocale();

  return (
    <GlassCard className={cn('flex h-full flex-col justify-between', className)}>
      <div className="space-y-3">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--accent)/0.15)] px-3 py-1 text-xs font-medium text-[hsl(var(--accent))]">
          <Sparkles className="h-3 w-3" />
          DeepSeek
        </div>
        <h3 className="display-headline text-2xl">{t('title')}</h3>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="mt-6 space-y-3">
        <div className="rounded-2xl border border-white/40 dark:border-white/10 bg-white/50 dark:bg-white/5 p-3 text-sm text-muted-foreground">
          {locale === 'zh'
            ? '🎓 他研究 LLM 机器遗忘吗？\n💼 实习经历亮点？\n🛠 最熟悉哪些技术栈？'
            : '🎓 Does he research LLM unlearning?\n💼 Highlights of his internships?\n🛠 Which stacks does he know best?'}
        </div>
        <Button asChild variant="gradient" className="w-full">
          <Link href={`/${locale}/chat`}>
            {t('openFull')}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </GlassCard>
  );
}
