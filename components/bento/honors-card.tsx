'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Crown, Brain, Mountain, Heart } from 'lucide-react';
import { GlassCard } from '@/components/glass-card';
import { pickLocale, type Honor } from '@/lib/profile';
import type { Locale } from '@/i18n';
import { cn } from '@/lib/utils';

const iconFor = {
  morality: Crown,
  wisdom: Brain,
  athletics: Mountain,
  labor: Heart,
} as const;

export function HonorsCard({
  honors,
  locale,
  className,
}: {
  honors: Honor[];
  locale: Locale;
  className?: string;
}) {
  const t = useTranslations('sections.honors');

  return (
    <GlassCard density="cozy" className={cn('h-full', className)}>
      <div className="flex h-full flex-col gap-4">
        <div>
          <h3 className="display-headline text-2xl">{t('title')}</h3>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-3">
          {honors.slice(0, 4).map((h) => (
            <HonorTile key={h.pillar} honor={h} locale={locale} label={t(h.pillar)} />
          ))}
        </div>
      </div>
    </GlassCard>
  );
}

function HonorTile({ honor, locale, label }: { honor: Honor; locale: Locale; label: string }) {
  const [flipped, setFlipped] = React.useState(false);
  const [hasFinePointer, setHasFinePointer] = React.useState(false);
  const Icon = iconFor[honor.pillar];

  React.useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const update = () => setHasFinePointer(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const hoverProps = hasFinePointer
    ? {
        onMouseEnter: () => setFlipped(true),
        onMouseLeave: () => setFlipped(false),
        onFocus: () => setFlipped(true),
        onBlur: () => setFlipped(false),
      }
    : {};

  return (
    <button
      type="button"
      {...hoverProps}
      onClick={() => setFlipped((v) => !v)}
      className="group relative h-28 sm:h-32 perspective-[800px] focus:outline-none"
      aria-label={pickLocale(honor.title, locale)}
      aria-pressed={flipped}
    >
      <motion.div
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
        className="relative h-full w-full"
        style={{ transformStyle: 'preserve-3d' }}
      >
        <div
          className="absolute inset-0 flex flex-col items-start justify-between rounded-2xl border border-white/40 dark:border-white/10 bg-white/40 dark:bg-white/5 p-3"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <Icon className="h-5 w-5 text-[hsl(var(--primary))]" />
          <div className="text-left">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
            <p className="mt-1 text-sm font-semibold leading-tight">
              {pickLocale(honor.title, locale)}
            </p>
          </div>
        </div>
        <div
          className="absolute inset-0 flex items-center rounded-2xl border border-white/40 dark:border-white/10 bg-[hsl(var(--primary)/0.12)] p-3 text-left text-[11px] leading-snug text-foreground/90 sm:text-xs"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          {pickLocale(honor.story, locale)}
        </div>
      </motion.div>
    </button>
  );
}
