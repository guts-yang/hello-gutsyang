'use client';

import { useRouter } from 'next/navigation';
import { KNOWN_ACTIONS } from './audit-constants';

export function AuditFilter({ action }: { action: string }) {
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">筛选动作</span>
        <select
          value={action}
          onChange={(e) => {
            const next = e.target.value;
            const url = next ? `/admin/audit?action=${encodeURIComponent(next)}` : '/admin/audit';
            router.push(url);
          }}
          className="h-10 min-w-[12rem] rounded-2xl border border-white/40 bg-white/40 px-3 text-sm dark:border-white/10 dark:bg-white/5"
        >
          <option value="">全部</option>
          {KNOWN_ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
