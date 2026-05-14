import { ProjectForm } from '../project-form';

export default function NewProjectPage() {
  return (
    <div className="space-y-4">
      <h1 className="display-headline text-3xl text-gradient">新建项目</h1>
      <ProjectForm />
    </div>
  );
}
