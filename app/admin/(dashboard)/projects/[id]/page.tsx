import { notFound } from 'next/navigation';
import { ProjectForm } from '../project-form';
import { getProjectRow } from '@/lib/admin-api';

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getProjectRow(id).catch(() => null);
  if (!data) notFound();
  return (
    <div className="space-y-4">
      <h1 className="display-headline text-3xl text-gradient">编辑项目</h1>
      <ProjectForm row={data} />
    </div>
  );
}
