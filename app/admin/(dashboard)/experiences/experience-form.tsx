'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { GlassCard } from '@/components/glass-card';
import { Button } from '@/components/ui/button';
import { Field, TextInput, TextArea, Switch } from '@/components/admin/form-fields';
import { saveExperience } from '@/app/admin/actions';
import type { DbExperienceRow } from '@/lib/api-types';

type FormResult = { ok: boolean; message: string } | undefined;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="gradient" disabled={pending}>
      {pending ? '保存中…' : '保存'}
    </Button>
  );
}

export function ExperienceForm({ row }: { row?: DbExperienceRow }) {
  const [state, formAction] = useFormState<FormResult, FormData>(saveExperience as never, undefined);

  return (
    <form action={formAction} className="space-y-5">
      {row && <input type="hidden" name="id" value={row.id} />}
      <GlassCard>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Slug">
            <TextInput name="slug" defaultValue={row?.slug} required />
          </Field>
          <Field label="Link (URL)">
            <TextInput type="url" name="link" defaultValue={row?.link ?? ''} />
          </Field>
          <Field label="组织（中文）">
            <TextInput name="org_zh" defaultValue={row?.org_zh} required />
          </Field>
          <Field label="Org (English)">
            <TextInput name="org_en" defaultValue={row?.org_en} required />
          </Field>
          <Field label="角色（中文）">
            <TextInput name="role_zh" defaultValue={row?.role_zh} />
          </Field>
          <Field label="Role (English)">
            <TextInput name="role_en" defaultValue={row?.role_en} />
          </Field>
          <Field label="描述（中文）" className="sm:col-span-2">
            <TextArea name="summary_zh" defaultValue={row?.summary_zh} rows={4} />
          </Field>
          <Field label="Summary (English)" className="sm:col-span-2">
            <TextArea name="summary_en" defaultValue={row?.summary_en} rows={4} />
          </Field>
          <Field label="量化指标 JSON" className="sm:col-span-2" hint='[{"zh":"...", "en":"..."}, ...]'>
            <TextArea
              name="metrics"
              defaultValue={JSON.stringify(row?.metrics ?? [], null, 2)}
              rows={5}
            />
          </Field>
          <Field label="开始日期">
            <TextInput type="date" name="started_at" defaultValue={row?.started_at?.slice(0, 10)} required />
          </Field>
          <Field label="结束日期">
            <TextInput type="date" name="ended_at" defaultValue={row?.ended_at?.slice(0, 10) ?? ''} />
          </Field>
          <Field label="排序">
            <TextInput type="number" name="display_order" defaultValue={row?.display_order ?? 0} />
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
