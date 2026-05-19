import Link from 'next/link';
import { Plus, Pencil } from 'lucide-react';
import { GlassCard } from '@/components/glass-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DeleteButton } from '../delete-button';
import { deleteProject } from '@/app/admin/actions';
import { listProjectRows } from '@/lib/admin-api';

export default async function AdminProjectsPage() {
<<<<<<< Updated upstream
  const supabase = createSupabaseServerClient();
  const { data } = await supabase!
    .from('projects')
    .select('*')
    .order('display_order', { ascending: false })
    .order('started_at', { ascending: false });
  const rows = (data ?? []) as DbProjectRow[];
=======
  const rows = await listProjectRows();
>>>>>>> Stashed changes

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="display-headline text-3xl text-gradient">Projects</h1>
          <p className="text-sm text-muted-foreground">{rows.length} 条记录</p>
        </div>
        <Button asChild variant="gradient" size="sm">
          <Link href="/admin/projects/new">
            <Plus className="h-4 w-4" />
            新建
          </Link>
        </Button>
      </header>

      <div className="grid gap-3">
        {rows.map((row) => (
          <GlassCard key={row.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge tone={row.kind === 'academic' ? 'accent' : 'default'}>{row.kind}</Badge>
                  {!row.is_published && <Badge tone="muted">draft</Badge>}
                </div>
                <p className="mt-1 truncate text-base font-medium">
                  {row.title_zh} <span className="text-muted-foreground">· {row.title_en}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  /projects/{row.slug} · order {row.display_order}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/admin/projects/${row.id}`}>
                    <Pencil className="h-3.5 w-3.5" />
                    编辑
                  </Link>
                </Button>
                <DeleteButton id={row.id} action={deleteProject} />
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
