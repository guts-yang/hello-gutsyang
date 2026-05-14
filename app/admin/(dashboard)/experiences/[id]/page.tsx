import { notFound } from 'next/navigation';
import { ExperienceForm } from '../experience-form';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { DbExperienceRow } from '@/lib/supabase/types';

export default async function EditExperiencePage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase!.from('experiences').select('*').eq('id', params.id).maybeSingle();
  if (!data) notFound();
  return (
    <div className="space-y-4">
      <h1 className="display-headline text-3xl text-gradient">编辑经历</h1>
      <ExperienceForm row={data as DbExperienceRow} />
    </div>
  );
}
