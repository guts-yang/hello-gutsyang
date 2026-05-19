'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { GlassCard } from '@/components/glass-card';
import { Button } from '@/components/ui/button';
import { Field, TextInput, TextArea } from '@/components/admin/form-fields';
import { ImageUploader } from '@/components/admin/image-uploader';
import { saveProfile } from '@/app/admin/actions';
import type { DbProfileRow } from '@/lib/api-types';

type FormResult = { ok: boolean; message: string } | undefined;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="gradient" disabled={pending}>
      {pending ? '保存中…' : '保存'}
    </Button>
  );
}

export function ProfileForm({ row }: { row: DbProfileRow | null }) {
  const [state, formAction] = useFormState<FormResult, FormData>(saveProfile as never, undefined);

  return (
    <form action={formAction} className="space-y-5">
      <GlassCard>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="中文姓名">
            <TextInput name="name_zh" defaultValue={row?.name_zh ?? ''} required />
          </Field>
          <Field label="English Name">
            <TextInput name="name_en" defaultValue={row?.name_en ?? ''} required />
          </Field>
          <Field label="Handle" hint="GitHub / 用户名">
            <TextInput name="handle" defaultValue={row?.handle ?? ''} required />
          </Field>
          <Field label="头像">
            <ImageUploader name="avatar_url" defaultUrl={row?.avatar_url ?? ''} folder="avatars" />
          </Field>
          <Field label="Role（中）">
            <TextInput name="role_zh" defaultValue={row?.role_zh ?? ''} />
          </Field>
          <Field label="Role (EN)">
            <TextInput name="role_en" defaultValue={row?.role_en ?? ''} />
          </Field>
          <Field label="Slogan（中）" className="sm:col-span-2">
            <TextInput name="slogan_zh" defaultValue={row?.slogan_zh ?? ''} />
          </Field>
          <Field label="Slogan (EN)" className="sm:col-span-2">
            <TextInput name="slogan_en" defaultValue={row?.slogan_en ?? ''} />
          </Field>
          <Field label="Bio（中）" className="sm:col-span-2">
            <TextArea name="bio_zh" defaultValue={row?.bio_zh ?? ''} rows={4} />
          </Field>
          <Field label="Bio (EN)" className="sm:col-span-2">
            <TextArea name="bio_en" defaultValue={row?.bio_en ?? ''} rows={4} />
          </Field>
          <Field
            label="Socials JSON"
            className="sm:col-span-2"
            hint='[{"type":"github","href":"https://..."},{"type":"wechat","href":"#wechat"}]'
          >
            <TextArea
              name="socials"
              defaultValue={JSON.stringify(row?.socials ?? [], null, 2)}
              rows={5}
            />
          </Field>
        </div>
      </GlassCard>
      <div className="flex items-center gap-3">
        <SubmitButton />
        {state?.ok && <p className="text-xs text-emerald-500">{state.message}</p>}
        {state?.ok === false && <p className="text-xs text-rose-500">{state.message}</p>}
      </div>
    </form>
  );
}
