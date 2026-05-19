'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function LoginForm({
  configured,
  error,
  redirectTo,
}: {
  configured: boolean;
  error?: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(
    error === 'forbidden' ? '该邮箱不在管理员白名单中。' : null,
  );

  if (!configured) {
    return (
      <div className="rounded-2xl border border-amber-300/40 bg-amber-100/30 p-4 text-xs text-amber-800 dark:text-amber-200">
        Go 后端还未配置。请在 <code>.env.local</code> 中填写
        <br />
        <code className="text-[11px]">GO_API_URL</code>
        与 <code className="text-[11px]">GO_API_INTERNAL_URL</code>，并启动 Go API 后再来。
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message || '登录失败');
      }
      router.replace(redirectTo || '/admin');
      router.refresh();
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : '登录失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="block space-y-1.5">
        <span className="text-xs text-muted-foreground">Email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-10 w-full rounded-full border border-white/40 dark:border-white/10 bg-white/40 dark:bg-white/5 px-4 text-sm outline-none focus:border-[hsl(var(--primary)/0.5)]"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-xs text-muted-foreground">Password</span>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-10 w-full rounded-full border border-white/40 dark:border-white/10 bg-white/40 dark:bg-white/5 px-4 text-sm outline-none focus:border-[hsl(var(--primary)/0.5)]"
        />
      </label>
      <Button type="submit" disabled={busy} variant="gradient" className="w-full">
        {busy ? '登录中…' : '登录'}
      </Button>
      {message && <p className="text-center text-xs text-rose-500">{message}</p>}
    </form>
  );
}
