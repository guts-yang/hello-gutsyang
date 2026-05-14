import * as React from 'react';
import { cn } from '@/lib/utils';

type GlassCardProps = React.HTMLAttributes<HTMLDivElement> & {
  as?: 'div' | 'article' | 'section';
  interactive?: boolean;
  innerClassName?: string;
};

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(function GlassCard(
  { as: As = 'div', interactive = false, className, innerClassName, children, ...rest },
  ref,
) {
  return (
    <As
      ref={ref as never}
      className={cn(
        'glass relative overflow-hidden rounded-3xl',
        interactive && 'glass-hover cursor-pointer',
        className,
      )}
      {...rest}
    >
      {/* Inner shimmer line that catches light at the top edge. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent dark:via-white/30"
      />
      <div className={cn('relative h-full w-full p-6 sm:p-7', innerClassName)}>{children}</div>
    </As>
  );
});
