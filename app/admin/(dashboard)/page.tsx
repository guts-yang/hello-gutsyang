import Link from 'next/link';
import { GlassCard } from '@/components/glass-card';
import { getAdminStats } from '@/lib/admin-api';

export default async function AdminHomePage() {
  const c = await getAdminStats().catch(() => ({ projects: 0, experiences: 0, honors: 0 }));
  const tiles = [
    { label: '项目', value: c.projects, href: '/admin/projects' },
    { label: '经历', value: c.experiences, href: '/admin/experiences' },
    { label: '荣誉', value: c.honors, href: '/admin/honors' },
  ];
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="display-headline text-3xl text-gradient">总览</h1>
        <p className="text-sm text-muted-foreground">直接编辑内容；保存后前台会同步更新。</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-3">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href} className="block">
            <GlassCard interactive className="h-full">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">{t.label}</p>
              <p className="mt-2 display-headline text-4xl text-gradient">{t.value}</p>
            </GlassCard>
          </Link>
        ))}
      </div>
    </div>
  );
}
