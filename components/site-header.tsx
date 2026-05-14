'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Download } from 'lucide-react';
import { ThemeToggle } from './theme-toggle';
import { LocaleToggle } from './locale-toggle';
import { Button } from './ui/button';

export function SiteHeader() {
  const t = useTranslations('nav');
  const locale = useLocale();
  const base = `/${locale}`;

  const navItems: Array<{ href: string; key: 'home' | 'projects' | 'experience' | 'blog' }> = [
    { href: `${base}`, key: 'home' },
    { href: `${base}#projects`, key: 'projects' },
    { href: `${base}#experience`, key: 'experience' },
    { href: `${base}#timeline`, key: 'blog' },
  ];

  return (
    <header className="sticky top-4 z-40 mx-auto w-full max-w-6xl px-4 sm:px-6">
      <div className="glass-strong flex items-center justify-between gap-3 rounded-full px-4 py-2 sm:px-5">
        <Link href={base} className="flex items-center gap-2">
          <span className="display-headline text-lg font-semibold tracking-tight text-gradient">
            chenyliao
          </span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-white/40 hover:text-foreground dark:hover:bg-white/10"
            >
              {t(item.key)}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <LocaleToggle />
          <ThemeToggle />
          <Button asChild size="sm" variant="gradient" className="hidden sm:inline-flex">
            <a href={`/api/resume.pdf?lang=${locale}`} target="_blank" rel="noopener noreferrer">
              <Download className="h-3.5 w-3.5" />
              {t('downloadResume')}
            </a>
          </Button>
        </div>
      </div>
    </header>
  );
}
