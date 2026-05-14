'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

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
  const [message, setMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (error === 'forbidden') {
      setMessage('该邮箱不在管理员白名单中。');
    }
  }, [error]);

  if (!configured) {
    return (
      <div className="rounded-2xl border border-amber-300/40 bg-amber-100/30 p-4 text-xs text-amber-800 dark:text-amber-200">
        Supabase 还未配置。请在 <code>.env.local</code> 中填写
        <br />
        <code className="text-[11px]">NEXT_PUBLIC_SUPABASE_URL</code>、
        <code className="text-[11px]">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>，并在 Supabase Dashboard 创建对应账号后再来。
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setBusy(true);
    setMessage(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
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
