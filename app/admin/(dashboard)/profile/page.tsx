import { ProfileForm } from './profile-form';
import { getAdminProfileRow } from '@/lib/admin-api';

export default async function AdminProfilePage() {
<<<<<<< Updated upstream
  const supabase = createSupabaseServerClient();
  const { data } = await supabase!.from('profile').select('*').eq('id', 'main').maybeSingle();
=======
  const data = await getAdminProfileRow();
>>>>>>> Stashed changes
  return (
    <div className="space-y-4">
      <h1 className="display-headline text-3xl text-gradient">Profile</h1>
      <p className="text-sm text-muted-foreground">主个人资料；修改后保存即生效。</p>
      <ProfileForm row={data} />
    </div>
  );
}
