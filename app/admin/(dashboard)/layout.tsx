import { redirect } from 'next/navigation';
import { AdminSidebar } from './sidebar';
import { requireAdminSession } from '@/lib/admin-api';
import { isBackendConfigured } from '@/lib/backend';

// Admin pages depend on the user's session cookie + DB and should never be
// statically prerendered.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (!isBackendConfigured()) {
    redirect('/admin/login');
  }
<<<<<<< Updated upstream
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = (await supabase!.auth.getUser()) ?? { data: { user: null } };
  if (!user) redirect('/admin/login');
=======
  const session = await requireAdminSession();
>>>>>>> Stashed changes

  return (
    <div className="mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 gap-6 px-4 py-6 md:grid-cols-[240px,1fr] md:px-6">
      <AdminSidebar email={session.user?.email ?? ''} />
      <main className="min-w-0">{children}</main>
    </div>
  );
}
