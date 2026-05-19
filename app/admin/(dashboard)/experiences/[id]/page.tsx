import { notFound } from 'next/navigation';
import { ExperienceForm } from '../experience-form';
import { getExperienceRow } from '@/lib/admin-api';

<<<<<<< Updated upstream
export default async function EditExperiencePage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase!.from('experiences').select('*').eq('id', params.id).maybeSingle();
=======
export default async function EditExperiencePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getExperienceRow(id).catch(() => null);
>>>>>>> Stashed changes
  if (!data) notFound();
  return (
    <div className="space-y-4">
      <h1 className="display-headline text-3xl text-gradient">编辑经历</h1>
      <ExperienceForm row={data} />
    </div>
  );
}
