import { ChangePasswordCard } from './change-password-card';
import { ChangeEmailCard } from './change-email-card';
import { SessionsCard } from './sessions-card';
import { getAdminSession, listAdminSessions } from '@/lib/admin-api';
import type { AdminSessionListItem } from '@/lib/api-types';

// Settings is a server component so the initial sessions render is auth-aware
// and the email field is pre-filled with the current admin's email. Mutations
// are delegated to the actions in ./actions.ts.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminSettingsPage() {
  const session = await getAdminSession();
  let sessions: AdminSessionListItem[] = [];
  try {
    sessions = await listAdminSessions();
  } catch {
    sessions = [];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display-headline text-3xl text-gradient">设置</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          管理你的登录凭据与活跃会话；改密会强制其它设备退出。
        </p>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <ChangePasswordCard />
        <ChangeEmailCard currentEmail={session.user?.email ?? ''} />
      </div>
      <SessionsCard sessions={sessions} />
    </div>
  );
}
