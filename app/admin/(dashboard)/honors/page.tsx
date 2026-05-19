import Link from 'next/link';
import { Plus, Pencil } from 'lucide-react';
import { GlassCard } from '@/components/glass-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DeleteButton } from '../delete-button';
import { deleteHonor } from '@/app/admin/actions';
import { listHonorRows } from '@/lib/admin-api';

export default async function AdminHonorsPage() {
<<<<<<< Updated upstream
  const supabase = createSupabaseServerClient();
  const { data } = await supabase!
    .from('honors')
    .select('*')
    .order('display_order', { ascending: false });
  const rows = (data ?? []) as DbHonorRow[];
=======
  const rows = await listHonorRows();
>>>>>>> Stashed changes

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="display-headline text-3xl text-gradient">Honors</h1>
          <p className="text-sm text-muted-foreground">{rows.length} 条记录</p>
        </div>
        <Button asChild variant="gradient" size="sm">
          <Link href="/admin/honors/new">
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
                <Badge tone="accent">{row.pillar}</Badge>
                <p className="mt-1 truncate text-base font-medium">{row.title_zh}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">{row.story_zh}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/admin/honors/${row.id}`}>
                    <Pencil className="h-3.5 w-3.5" />
                    编辑
                  </Link>
                </Button>
                <DeleteButton id={row.id} action={deleteHonor} />
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
