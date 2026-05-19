import { GlassCard } from '@/components/glass-card';

export default function AdminDashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-10 w-48 rounded-2xl bg-white/40 dark:bg-white/10" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <GlassCard key={i} className="h-28" />
        ))}
      </div>
    </div>
  );
}
