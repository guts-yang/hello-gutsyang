import { Download, FileText } from 'lucide-react';
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
      <GlassCard interactive density="compact" className="h-full">
        <div className="flex h-full items-center justify-between gap-3">
          <div className="flex flex-col gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--primary)/0.12)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--primary))]">
              <FileText className="h-3 w-3" />
              PDF
            </span>
            <p className="display-headline text-2xl text-foreground">
              {t('downloadResume')}
            </p>
            <p className="text-xs text-muted-foreground">{locale === 'zh' ? '一键导出 · 中英可切' : 'One click · zh / en'}</p>
          </div>
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent))] text-white shadow-[0_8px_24px_-8px_hsl(var(--primary)/0.44)] transition-transform group-hover:translate-y-0.5">
            <Download className="h-5 w-5" />
          </div>
        </div>
      </GlassCard>
    </a>
  );
}
