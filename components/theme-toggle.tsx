'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const options: Array<{ value: 'light' | 'dark' | 'system'; icon: React.ReactNode }> = [
    { value: 'light', icon: <Sun className="h-3.5 w-3.5" /> },
    { value: 'system', icon: <Monitor className="h-3.5 w-3.5" /> },
    { value: 'dark', icon: <Moon className="h-3.5 w-3.5" /> },
  ];

  const active = mounted ? (theme as 'light' | 'dark' | 'system') ?? 'system' : 'system';

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex items-center gap-1 rounded-full border border-white/40 dark:border-white/10 bg-white/40 dark:bg-white/5 p-1 backdrop-blur-md"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={active === opt.value}
          onClick={() => setTheme(opt.value)}
          className={cn(
            'inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors',
            active === opt.value
              ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {opt.icon}
          <span className="sr-only">{opt.value}</span>
        </button>
      ))}
    </div>
  );
}
