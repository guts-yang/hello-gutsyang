import { cn } from '@/lib/utils';

/**
 * Lightweight aurora background: fewer blobs, softer blur, and no heavy
 * desktop-wide blend stack on mobile. Keeps the visual language while cutting
 * down compositor work on scroll and pointer interaction.
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

      {/* Drifting aurora blobs. Reduced from four layers to two. */}
      <div className="absolute -inset-[12%]">
        <div
          className="absolute left-[2%] top-[6%] h-[54vmax] w-[54vmax] rounded-full opacity-50 blur-[72px] md:blur-[96px] md:animate-aurora-drift"
          style={{
            background:
              'radial-gradient(circle at 30% 30%, hsl(var(--aurora-1) / 0.7), transparent 62%)',
            animationDelay: '0s',
          }}
        />
        <div
          className="absolute right-[-8%] top-[22%] h-[58vmax] w-[58vmax] rounded-full opacity-45 blur-[84px] md:blur-[110px] md:animate-aurora-drift"
          style={{
            background:
              'radial-gradient(circle at 70% 32%, hsl(var(--aurora-2) / 0.68), transparent 62%)',
            animationDelay: '-8s',
          }}
        />
      </div>

      {/* Subtle grain to remove banding on the gradients. */}
      <div
        className="absolute inset-0 opacity-[0.04]"
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
