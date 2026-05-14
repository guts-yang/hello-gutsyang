import * as React from 'react';
import { cn } from '@/lib/utils';

export function Badge({
  className,
  children,
  tone = 'default',
  ...rest
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: 'default' | 'accent' | 'muted' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium tracking-wide transition-colors',
        tone === 'default' &&
          'border border-white/40 dark:border-white/10 bg-white/40 dark:bg-white/5 text-foreground',
        tone === 'accent' &&
          'bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))] border border-[hsl(var(--primary)/0.25)]',
        tone === 'muted' && 'bg-muted text-muted-foreground',
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
