'use client';

import { GraduationCap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { GlassCard } from '@/components/glass-card';
import { pickLocale, type Education } from '@/lib/profile';
import type { Locale } from '@/i18n';
import { cn, formatDate } from '@/lib/utils';

export function EducationCard({
  education,
  locale,
  className,
}: {
  education: Education;
  locale: Locale;
  className?: string;
}) {
  const t = useTranslations('sections.education');
  return (
    <GlassCard density="compact" className={cn('h-full', className)}>
      <div className="flex h-full flex-col justify-between gap-3">
        <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest text-muted-foreground">
          <GraduationCap className="h-3.5 w-3.5" />
          {t('title')}
        </div>
        <div className="space-y-1">
          <p className="display-headline text-xl">{pickLocale(education.school, locale)}</p>
          <p className="text-xs text-muted-foreground">{pickLocale(education.degree, locale)}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          {formatDate(education.startedAt, locale)} —{' '}
          {education.endedAt
            ? formatDate(education.endedAt, locale)
            : locale === 'zh'
              ? '至今'
              : 'Present'}
        </p>
      </div>
    </GlassCard>
  );
}
