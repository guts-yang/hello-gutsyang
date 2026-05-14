import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ProfileForm } from './profile-form';
import type { DbProfileRow } from '@/lib/supabase/types';

export default async function AdminProfilePage() {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase!.from('profile').select('*').eq('id', 'main').maybeSingle();
  return (
    <div className="space-y-4">
      <h1 className="display-headline text-3xl text-gradient">Profile</h1>
      <p className="text-sm text-muted-foreground">主个人资料；修改后保存即生效。</p>
      <ProfileForm row={data as DbProfileRow | null} />
    </div>
  );
}
