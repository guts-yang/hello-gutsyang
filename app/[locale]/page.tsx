import { setRequestLocale } from 'next-intl/server';
import { BentoGrid } from '@/components/bento/bento-grid';
import type { Locale } from '@/i18n';

export default function HomePage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <BentoGrid locale={locale as Locale} />
    </div>
  );
}
