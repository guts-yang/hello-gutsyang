'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { GlassCard } from '@/components/glass-card';
import { Button } from '@/components/ui/button';
import { Field, TextInput, TextArea, Switch } from '@/components/admin/form-fields';
import { saveHonor } from '@/app/admin/actions';
import type { DbHonorRow } from '@/lib/api-types';

type FormResult = { ok: boolean; message: string } | undefined;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="gradient" disabled={pending}>
      {pending ? '保存中…' : '保存'}
    </Button>
  );
}

export function HonorForm({ row }: { row?: DbHonorRow }) {
  const [state, formAction] = useFormState<FormResult, FormData>(saveHonor as never, undefined);

  return (
    <form action={formAction} className="space-y-5">
      {row && <input type="hidden" name="id" value={row.id} />}
      <GlassCard>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Pillar">
            <select
              name="pillar"
              defaultValue={row?.pillar ?? 'morality'}
              className="h-10 w-full rounded-2xl border border-white/40 dark:border-white/10 bg-white/40 dark:bg-white/5 px-4 text-sm outline-none"
            >
              <option value="morality">morality · 德</option>
              <option value="wisdom">wisdom · 智</option>
              <option value="athletics">athletics · 体</option>
              <option value="labor">labor · 劳</option>
            </select>
          </Field>
          <Field label="排序">
            <TextInput type="number" name="display_order" defaultValue={row?.display_order ?? 0} />
          </Field>
          <Field label="标题（中文）">
            <TextInput name="title_zh" defaultValue={row?.title_zh} required />
          </Field>
          <Field label="Title (English)">
            <TextInput name="title_en" defaultValue={row?.title_en} required />
          </Field>
          <Field label="故事（中文）" className="sm:col-span-2">
            <TextArea name="story_zh" defaultValue={row?.story_zh} rows={4} />
          </Field>
          <Field label="Story (English)" className="sm:col-span-2">
            <TextArea name="story_en" defaultValue={row?.story_en} rows={4} />
          </Field>
          <Field label="发布">
            <Switch name="is_published" defaultChecked={row?.is_published ?? true} />
          </Field>
        </div>
      </GlassCard>
      <div className="flex items-center gap-3">
        <SubmitButton />
        {state?.ok === false && <p className="text-xs text-rose-500">{state.message}</p>}
      </div>
    </form>
  );
}
