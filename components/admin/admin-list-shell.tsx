import type { ReactNode } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function AdminListShell({
  title,
  description,
  count,
  newHref,
  newLabel,
  saved,
  emptyMessage,
  emptyCtaHref,
  emptyCtaLabel,
  children,
}: {
  title: string;
  description?: string;
  count: number;
  newHref: string;
  newLabel: string;
  saved?: boolean;
  emptyMessage?: string;
  emptyCtaHref?: string;
  emptyCtaLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="display-headline text-3xl text-gradient">{title}</h1>
          <p className="text-sm text-muted-foreground">
            {description ?? `${count} 条记录`}
          </p>
        </div>
        <Button asChild variant="gradient" size="sm">
          <Link href={newHref}>{newLabel}</Link>
        </Button>
      </header>

      {saved && (
        <div className="rounded-2xl border border-emerald-300/40 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-200">
          保存成功
        </div>
      )}

      {count === 0 && emptyMessage ? (
        <div className="glass rounded-3xl p-8 text-center">
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
          {emptyCtaHref && emptyCtaLabel && (
            <Button asChild variant="gradient" size="sm" className="mt-4">
              <Link href={emptyCtaHref}>{emptyCtaLabel}</Link>
            </Button>
          )}
        </div>
      ) : (
        children
      )}
    </div>
  );
}
