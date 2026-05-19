import { notFound } from 'next/navigation';
import { HonorForm } from '../honor-form';
import { getHonorRow } from '@/lib/admin-api';

<<<<<<< Updated upstream
export default async function EditHonorPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase!.from('honors').select('*').eq('id', params.id).maybeSingle();
=======
export default async function EditHonorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getHonorRow(id).catch(() => null);
>>>>>>> Stashed changes
  if (!data) notFound();
  return (
    <div className="space-y-4">
      <h1 className="display-headline text-3xl text-gradient">编辑荣誉</h1>
      <HonorForm row={data} />
    </div>
  );
}
