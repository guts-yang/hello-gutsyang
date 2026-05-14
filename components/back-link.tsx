'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useLocale } from 'next-intl';

export function BackLink() {
  const locale = useLocale();
  return (
    <Link
      href={`/${locale}`}
      className="inline-flex items-center gap-2 rounded-full border border-white/40 dark:border-white/10 bg-white/40 dark:bg-white/5 px-3 py-1.5 text-xs font-medium backdrop-blur-md transition-all hover:-translate-x-0.5 hover:bg-white/60 dark:hover:bg-white/10"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      {locale === 'zh' ? '返回首页' : 'Back to home'}
    </Link>
  );
}
