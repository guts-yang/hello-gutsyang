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
  searchParams: { redirectTo?: string; error?: string };
}) {
<<<<<<< Updated upstream
  if (isSupabaseConfigured()) {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
    } = (await supabase!.auth.getUser()) ?? { data: { user: null } };
    if (user) redirect(searchParams.redirectTo || '/admin');
=======
  const { redirectTo, error } = await searchParams;
  if (isBackendConfigured()) {
    const session = await getAdminSession().catch(() => ({ authenticated: false as const }));
    if (session.authenticated) redirect(redirectTo || '/admin');
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
          configured={isSupabaseConfigured()}
          error={searchParams.error}
          redirectTo={searchParams.redirectTo}
=======
          configured={isBackendConfigured()}
          error={error}
          redirectTo={redirectTo}
>>>>>>> Stashed changes
        />
      </div>
    </div>
  );
}
