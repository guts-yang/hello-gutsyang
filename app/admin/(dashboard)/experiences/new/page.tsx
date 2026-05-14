import { ExperienceForm } from '../experience-form';

export default function NewExperiencePage() {
  return (
    <div className="space-y-4">
      <h1 className="display-headline text-3xl text-gradient">新建经历</h1>
      <ExperienceForm />
    </div>
  );
}
