import Link from 'next/link';
import { Pencil } from 'lucide-react';
import { GlassCard } from '@/components/glass-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AdminListShell } from '@/components/admin/admin-list-shell';
import { DeleteButton } from '../delete-button';
import { deleteProject } from '@/app/admin/actions';
import { listProjectRows } from '@/lib/admin-api';

export default async function AdminProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const { saved } = await searchParams;
  const rows = await listProjectRows();

  return (
    <AdminListShell
      title="项目"
      count={rows.length}
      newHref="/admin/projects/new"
      newLabel="新建"
      saved={saved === '1'}
      emptyMessage="还没有项目，创建第一条吧。"
      emptyCtaHref="/admin/projects/new"
      emptyCtaLabel="新建项目"
    >
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
    </AdminListShell>
  );
}
