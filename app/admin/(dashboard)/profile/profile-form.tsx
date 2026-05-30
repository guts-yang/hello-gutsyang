'use client';

import * as React from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { GlassCard } from '@/components/glass-card';
import { Button } from '@/components/ui/button';
import { Field, TextInput, TextArea } from '@/components/admin/form-fields';
import { ImageUploader } from '@/components/admin/image-uploader';
import { AiTranslateBar } from '@/components/admin/ai-translate-bar';
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
  const formRef = React.useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={formAction} className="space-y-5">
      <AiTranslateBar
        formRef={formRef}
        scalars={[
          { zhName: 'name_zh', enName: 'name_en', label: '姓名' },
          { zhName: 'role_zh', enName: 'role_en', label: 'Role' },
          { zhName: 'slogan_zh', enName: 'slogan_en', label: 'Slogan' },
          { zhName: 'bio_zh', enName: 'bio_en', label: 'Bio' },
        ]}
        initialEn={{
          name_en: row?.name_en ?? '',
          role_en: row?.role_en ?? '',
          slogan_en: row?.slogan_en ?? '',
          bio_en: row?.bio_en ?? '',
        }}
      />

      <GlassCard>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="中文姓名">
            <TextInput name="name_zh" defaultValue={row?.name_zh ?? ''} required />
          </Field>
          <Field label="Handle" hint="GitHub / 用户名（语言无关）">
            <TextInput name="handle" defaultValue={row?.handle ?? ''} required />
          </Field>
          <Field label="头像" hint="支持 png / jpg / webp" className="sm:col-span-2">
            <ImageUploader
              name="avatar_url"
              defaultUrl={row?.avatar_url ?? ''}
              folder="avatars"
              variant="avatar"
              caption="上传后会同步显示在首页 Hero 头像区域。"
            />
          </Field>
          <Field label="角色（中文）">
            <TextInput name="role_zh" defaultValue={row?.role_zh ?? ''} />
          </Field>
          <Field label="一句话标语（中文）">
            <TextInput name="slogan_zh" defaultValue={row?.slogan_zh ?? ''} />
          </Field>
          <Field label="自我介绍（中文）" className="sm:col-span-2">
            <TextArea name="bio_zh" defaultValue={row?.bio_zh ?? ''} rows={4} />
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
