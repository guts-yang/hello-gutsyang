import { cn } from '@/lib/utils';

/**
 * Aurora-style background built from layered radial gradients with heavy blur
 * and `mix-blend-mode`. Pure CSS, GPU-friendly, and respects prefers-reduced-motion
 * (the slow drift is paused).
 */
export function AuroraBackground({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[hsl(var(--background))]',
        className,
      )}
    >
      {/* Static base wash so the page never goes pure-white before paint. */}
      <div className="absolute inset-0 bg-gradient-to-b from-[hsl(var(--background))] via-transparent to-[hsl(var(--background))]" />

      {/* Drifting aurora blobs. */}
      <div className="absolute -inset-[20%]">
        <div
          className="absolute left-[5%] top-[8%] h-[55vmax] w-[55vmax] rounded-full opacity-60 mix-blend-screen blur-[120px] animate-aurora-drift"
          style={{
            background:
              'radial-gradient(circle at 30% 30%, hsl(var(--aurora-1) / 0.85), transparent 60%)',
            animationDelay: '0s',
          }}
        />
        <div
          className="absolute right-[-10%] top-[20%] h-[60vmax] w-[60vmax] rounded-full opacity-55 mix-blend-screen blur-[140px] animate-aurora-drift"
          style={{
            background:
              'radial-gradient(circle at 70% 30%, hsl(var(--aurora-2) / 0.8), transparent 60%)',
            animationDelay: '-6s',
          }}
        />
        <div
          className="absolute left-[20%] bottom-[-10%] h-[55vmax] w-[55vmax] rounded-full opacity-55 mix-blend-screen blur-[140px] animate-aurora-drift"
          style={{
            background:
              'radial-gradient(circle at 50% 60%, hsl(var(--aurora-3) / 0.75), transparent 60%)',
            animationDelay: '-12s',
          }}
        />
        <div
          className="absolute right-[10%] bottom-[5%] h-[45vmax] w-[45vmax] rounded-full opacity-50 mix-blend-screen blur-[120px] animate-aurora-drift"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, hsl(var(--aurora-4) / 0.7), transparent 60%)',
            animationDelay: '-18s',
          }}
        />
      </div>

      {/* Subtle grain to remove banding on the gradients. */}
      <div
        className="absolute inset-0 opacity-[0.07] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Vignette / readability mask. */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,hsl(var(--background)/0.55)_85%)]" />
    </div>
  );
}
