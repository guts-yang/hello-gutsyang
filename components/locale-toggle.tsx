'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { locales } from '@/i18n';

export function LocaleToggle() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function switchTo(target: string) {
    if (target === locale) return;
    const segments = pathname.split('/');
    if (segments.length > 1 && (locales as readonly string[]).includes(segments[1])) {
      segments[1] = target;
      router.push(segments.join('/') || '/');
    } else {
      router.push(`/${target}${pathname}`);
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label="Language"
      className="inline-flex items-center gap-1 rounded-full border border-white/40 dark:border-white/10 bg-white/40 dark:bg-white/5 p-1 backdrop-blur-md"
    >
      {locales.map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={locale === l}
          onClick={() => switchTo(l)}
          className={cn(
            'h-7 rounded-full px-3 text-xs font-semibold uppercase transition-colors',
            locale === l
              ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
