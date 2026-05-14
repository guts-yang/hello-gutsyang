import * as React from 'react';
import { cn } from '@/lib/utils';

type Density = 'compact' | 'cozy' | 'comfy';

const densityPadding: Record<Density, string> = {
  compact: 'p-4 sm:p-5',
  cozy: 'p-5 sm:p-7',
  comfy: 'p-6 sm:p-8 lg:p-10',
};

type GlassCardProps = React.HTMLAttributes<HTMLDivElement> & {
  as?: 'div' | 'article' | 'section';
  interactive?: boolean;
  innerClassName?: string;
  density?: Density;
};

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(function GlassCard(
  { as: As = 'div', interactive = false, density = 'cozy', className, innerClassName, children, ...rest },
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
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent dark:via-white/30"
      />
      <div className={cn('relative h-full w-full', densityPadding[density], innerClassName)}>
        {children}
      </div>
    </As>
  );
});
