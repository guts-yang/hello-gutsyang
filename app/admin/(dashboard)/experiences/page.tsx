import Link from 'next/link';
import { Plus, Pencil } from 'lucide-react';
import { GlassCard } from '@/components/glass-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DeleteButton } from '../delete-button';
import { deleteExperience } from '@/app/admin/actions';
import { listExperienceRows } from '@/lib/admin-api';

export default async function AdminExperiencesPage() {
  const rows = await listExperienceRows();

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="display-headline text-3xl text-gradient">实践经历</h1>
          <p className="text-sm text-muted-foreground">{rows.length} 条记录</p>
        </div>
        <Button asChild variant="gradient" size="sm">
          <Link href="/admin/experiences/new">
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
                  {!row.is_published && <Badge tone="muted">draft</Badge>}
                </div>
                <p className="mt-1 truncate text-base font-medium">
                  {row.org_zh}
                  <span className="text-muted-foreground"> · {row.role_zh}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  /experience/{row.slug} · order {row.display_order}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/admin/experiences/${row.id}`}>
                    <Pencil className="h-3.5 w-3.5" />
                    编辑
                  </Link>
                </Button>
                <DeleteButton id={row.id} action={deleteExperience} />
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
