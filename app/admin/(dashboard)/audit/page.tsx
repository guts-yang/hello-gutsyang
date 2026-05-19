import Link from 'next/link';
import { GlassCard } from '@/components/glass-card';
import { listAdminAudit } from '@/lib/admin-api';
import type { AdminAuditItem } from '@/lib/admin-api';
import { AuditFilter } from './audit-filter';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function actionTone(action: string) {
  if (action.startsWith('login.failure') || action.startsWith('login.locked')) {
    return 'text-rose-500';
  }
  if (action.startsWith('login.') || action.startsWith('password.') || action.startsWith('email.')) {
    return 'text-amber-500';
  }
  return 'text-foreground';
}

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; before?: string }>;
}) {
  const params = await searchParams;
  const action = params.action ?? '';
  const before = params.before ?? '';

  let entries: AdminAuditItem[] = [];
  let error = '';
  try {
    entries = await listAdminAudit({
      action: action || undefined,
      before: before || undefined,
      limit: 50,
    });
  } catch (e) {
    error = e instanceof Error ? e.message : 'failed to load';
  }

  const olderHref = entries.length === 50
    ? buildHref(action, entries[entries.length - 1]?.createdAt ?? '')
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="display-headline text-3xl text-gradient">审计日志</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            按时间倒序展示管理员登录、内容修改、会话变更等动作。
          </p>
        </div>
        <AuditFilter action={action} />
      </div>

      <GlassCard density="compact">
        {error && <p className="text-xs text-rose-500">{error}</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">时间</th>
                <th className="px-3 py-2 font-medium">动作</th>
                <th className="px-3 py-2 font-medium">对象 / 邮箱</th>
                <th className="px-3 py-2 font-medium">IP</th>
                <th className="px-3 py-2 font-medium">设备</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-xs text-muted-foreground">
                    没有匹配的记录
                  </td>
                </tr>
              )}
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-white/30 dark:border-white/10">
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {formatTimestamp(e.createdAt)}
                  </td>
                  <td className={`px-3 py-2 text-xs font-mono ${actionTone(e.action)}`}>{e.action}</td>
                  <td className="px-3 py-2 text-xs">{e.target || '—'}</td>
                  <td className="px-3 py-2 text-xs font-mono">{e.ip || '—'}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-[260px]" title={e.userAgent}>
                    {e.userAgent || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {olderHref && (
        <div className="text-right">
          <Link href={olderHref} className="text-xs text-muted-foreground hover:text-foreground">
            加载更早记录 →
          </Link>
        </div>
      )}
    </div>
  );
}

function buildHref(action: string, before: string) {
  const search = new URLSearchParams();
  if (action) search.set('action', action);
  if (before) search.set('before', before);
  return `/admin/audit?${search.toString()}`;
}
