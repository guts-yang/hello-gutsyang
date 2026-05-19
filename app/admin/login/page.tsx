import { redirect } from 'next/navigation';
import { LoginForm } from './login-form';
import { getAdminSession } from '@/lib/admin-api';
import { isBackendConfigured } from '@/lib/backend';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Admin Login',
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; error?: string }>;
}) {
  const { redirectTo, error } = await searchParams;
  if (isBackendConfigured()) {
    const session = await getAdminSession().catch(() => ({ authenticated: false as const }));
    if (session.authenticated) redirect(redirectTo || '/admin');
  }

  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="glass-strong w-full max-w-sm space-y-6 rounded-3xl p-8">
        <div className="space-y-2 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">CMS</p>
          <h1 className="display-headline text-3xl text-gradient">Admin</h1>
          <p className="text-xs text-muted-foreground">登录以管理你的个人站内容</p>
        </div>
        <LoginForm
          configured={isBackendConfigured()}
          error={error}
          redirectTo={redirectTo}
        />
      </div>
    </div>
  );
}
