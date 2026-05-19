import Link from 'next/link';
import { GlassCard } from '@/components/glass-card';
import { listExperienceRows, listHonorRows, listProjectRows } from '@/lib/admin-api';

async function counts() {
  const [projects, experiences, honors] = await Promise.all([
    listProjectRows(),
    listExperienceRows(),
    listHonorRows(),
  ]);
  return { projects: projects.length, experiences: experiences.length, honors: honors.length };
}

export default async function AdminHomePage() {
  const c = await counts();
  const tiles = [
    { label: 'Projects', value: c.projects, href: '/admin/projects' },
    { label: 'Experiences', value: c.experiences, href: '/admin/experiences' },
    { label: 'Honors', value: c.honors, href: '/admin/honors' },
  ];
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="display-headline text-3xl text-gradient">总览</h1>
        <p className="text-sm text-muted-foreground">直接编辑数据库内容；保存后前台立即同步。</p>
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
