import { Download } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { GlassCard } from '@/components/glass-card';
import { cn } from '@/lib/utils';
import type { Locale } from '@/i18n';

export function ResumeDownloadCard({ locale, className }: { locale: Locale; className?: string }) {
  const t = useTranslations('nav');
  return (
    <a
      href={`/api/resume.pdf?lang=${locale}`}
      target="_blank"
      rel="noopener noreferrer"
      className={cn('group block h-full', className)}
    >
      <GlassCard interactive className="h-full">
        <div className="flex h-full flex-col items-start justify-between gap-3">
          <Download className="h-6 w-6 text-[hsl(var(--primary))] transition-transform group-hover:translate-y-0.5" />
          <div>
            <p className="display-headline text-xl">PDF</p>
            <p className="text-xs text-muted-foreground">{t('downloadResume')}</p>
          </div>
        </div>
      </GlassCard>
    </a>
  );
}
