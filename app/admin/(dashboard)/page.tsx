import Link from 'next/link';
import { GlassCard } from '@/components/glass-card';
import { createSupabaseServerClient } from '@/lib/supabase/server';

async function counts() {
  const supabase = createSupabaseServerClient();
  if (!supabase) return { projects: 0, experiences: 0, honors: 0 };
  const [{ count: projects }, { count: experiences }, { count: honors }] = await Promise.all([
    supabase.from('projects').select('*', { count: 'exact', head: true }),
    supabase.from('experiences').select('*', { count: 'exact', head: true }),
    supabase.from('honors').select('*', { count: 'exact', head: true }),
  ]);
  return { projects: projects ?? 0, experiences: experiences ?? 0, honors: honors ?? 0 };
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
