import { notFound } from 'next/navigation';
import { HonorForm } from '../honor-form';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { DbHonorRow } from '@/lib/supabase/types';

export default async function EditHonorPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase!.from('honors').select('*').eq('id', params.id).maybeSingle();
  if (!data) notFound();
  return (
    <div className="space-y-4">
      <h1 className="display-headline text-3xl text-gradient">编辑荣誉</h1>
      <HonorForm row={data as DbHonorRow} />
    </div>
  );
}
