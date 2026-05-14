import { useTranslations } from 'next-intl';

export function SiteFooter() {
  const t = useTranslations('footer');
  return (
    <footer className="mx-auto mt-24 w-full max-w-6xl px-4 pb-10 pt-12 text-center text-xs text-muted-foreground sm:px-6">
      <div className="mx-auto h-px w-24 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
      <p className="mt-6">{t('made')}</p>
      <p className="mt-1">{t('copyright', { year: new Date().getFullYear() })}</p>
    </footer>
  );
}
