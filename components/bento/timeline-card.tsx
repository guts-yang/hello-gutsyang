'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { GlassCard } from '@/components/glass-card';
import { pickLocale } from '@/lib/profile';
import type { TimelineEvent } from '@/lib/content';
import type { Locale } from '@/i18n';
import { cn, formatDate } from '@/lib/utils';

const kindColor: Record<string, string> = {
  edu: 'hsl(var(--aurora-2))',
  work: 'hsl(var(--aurora-3))',
  project: 'hsl(var(--aurora-1))',
  honor: 'hsl(var(--aurora-4))',
};

export function TimelineCard({
  events,
  locale,
  className,
}: {
  events: TimelineEvent[];
  locale: Locale;
  className?: string;
}) {
  const t = useTranslations('sections.timeline');
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <GlassCard density="cozy" className={cn('h-full overflow-x-hidden', className)}>
      <div className="flex flex-col gap-6">
        <div>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>

        <div className="relative pl-2 sm:pl-0">
          <div className="absolute left-2 top-0 bottom-0 hidden w-px bg-gradient-to-b from-transparent via-[hsl(var(--primary)/0.4)] to-transparent sm:block" />
          <ol className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {sorted.map((evt, i) => (
              <motion.li
                key={evt.date + evt.title.zh}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.5, delay: i * 0.06 }}
                className="relative pl-6 sm:pl-0 sm:pt-6"
              >
                <span
                  aria-hidden
                  className="absolute left-0 top-1.5 h-3 w-3 rounded-full ring-4 ring-[hsl(var(--background))] sm:left-1/2 sm:top-0 sm:-translate-x-1/2"
                  style={{ background: kindColor[evt.kind] || 'hsl(var(--primary))' }}
                />
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {formatDate(evt.date, locale)}
                  </p>
                  <p className="text-sm font-semibold">{pickLocale(evt.title, locale)}</p>
                  <p className="text-xs text-muted-foreground">{pickLocale(evt.body, locale)}</p>
                </div>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </GlassCard>
  );
}
