import { HonorForm } from '../honor-form';

export default function NewHonorPage() {
  return (
    <div className="space-y-4">
      <h1 className="display-headline text-3xl text-gradient">新建荣誉</h1>
      <HonorForm />
    </div>
  );
}
