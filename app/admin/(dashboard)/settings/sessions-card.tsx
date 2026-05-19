'use client';

import * as React from 'react';
import { GlassCard } from '@/components/glass-card';
import { Button } from '@/components/ui/button';
import type { AdminSessionListItem } from '@/lib/api-types';
import { revokeAllOtherSessionsAction, revokeSessionAction } from './actions';

// Format helpers kept inline to avoid pulling in date-fns just for two strings.
// We render absolute dates in the user's locale plus a "n minutes ago" tail
// so quick scanning is easy without picking a date library.
function formatTimeAgo(iso: string) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.max(0, (Date.now() - then) / 1000);
  if (seconds < 60) return '刚刚';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟前`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时前`;
  return `${Math.floor(seconds / 86400)} 天前`;
}

function formatAbsolute(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function shortenUA(ua: string) {
  if (!ua) return '未知设备';
  const match = /(Chrome|Firefox|Safari|Edg|Opera|OPR)[\/ ]*([\d.]+)/.exec(ua);
  const os = /(Windows NT [\d.]+|Mac OS X [\d_]+|Android [\d.]+|iPhone OS [\d_]+|Linux)/.exec(ua);
  const browser = match ? `${match[1]} ${match[2]}` : ua.slice(0, 40);
  return os ? `${browser} · ${os[1].replace(/_/g, '.')}` : browser;
}

export function SessionsCard({ sessions }: { sessions: AdminSessionListItem[] }) {
  const [busy, setBusy] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<{ ok: boolean; message: string } | null>(null);

  const otherCount = sessions.filter((s) => !s.current).length;

  async function revoke(id: string) {
    setBusy(id);
    setFeedback(null);
    const result = await revokeSessionAction(id);
    setBusy(null);
    setFeedback(result);
  }

  async function revokeAll() {
    setBusy('all');
    setFeedback(null);
    const result = await revokeAllOtherSessionsAction();
    setBusy(null);
    setFeedback(result);
  }

  return (
    <GlassCard density="compact">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">活跃会话</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              这些是当前持有有效 cookie 的设备；标记为「当前」的会话来自你正在使用的浏览器。
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={otherCount === 0 || busy !== null}
            onClick={revokeAll}
          >
            {busy === 'all' ? '处理中…' : `踢出其它 ${otherCount} 个会话`}
          </Button>
        </div>

        {feedback && (
          <p className={feedback.ok ? 'text-xs text-emerald-500' : 'text-xs text-rose-500'}>
            {feedback.message}
          </p>
        )}

        <div className="overflow-hidden rounded-2xl border border-white/40 dark:border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/40 text-xs uppercase tracking-wider text-muted-foreground dark:bg-white/5">
              <tr>
                <th className="px-4 py-2 font-medium">设备</th>
                <th className="px-4 py-2 font-medium">IP</th>
                <th className="px-4 py-2 font-medium">最近活跃</th>
                <th className="px-4 py-2 font-medium">到期时间</th>
                <th className="px-4 py-2 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-xs text-muted-foreground">
                    暂无活跃会话
                  </td>
                </tr>
              )}
              {sessions.map((s) => (
                <tr key={s.id} className="border-t border-white/30 dark:border-white/10">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span>{shortenUA(s.userAgent ?? '')}</span>
                      {s.current && (
                        <span className="rounded-full bg-[hsl(var(--primary))] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[hsl(var(--primary-foreground))]">
                          当前
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{s.ip || '—'}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    <div>{formatTimeAgo(s.lastSeenAt)}</div>
                    <div className="text-[10px]">{formatAbsolute(s.lastSeenAt)}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatAbsolute(s.expiresAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={s.current || busy !== null}
                      onClick={() => revoke(s.id)}
                    >
                      {busy === s.id ? '处理中…' : '踢出'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </GlassCard>
  );
}
