import { notFound } from 'next/navigation';
import { ProjectForm } from '../project-form';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { DbProjectRow } from '@/lib/supabase/types';

export default async function EditProjectPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase!.from('projects').select('*').eq('id', params.id).maybeSingle();
  if (!data) notFound();
  return (
    <div className="space-y-4">
      <h1 className="display-headline text-3xl text-gradient">编辑项目</h1>
      <ProjectForm row={data as DbProjectRow} />
    </div>
  );
}
