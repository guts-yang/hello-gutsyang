'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { GlassCard } from '@/components/glass-card';
import { Button } from '@/components/ui/button';
import { Field, TextInput } from '@/components/admin/form-fields';
import { changeEmailAction } from './actions';

type FormResult = { ok: boolean; message: string } | undefined;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="gradient" disabled={pending}>
      {pending ? '保存中…' : '更新邮箱'}
    </Button>
  );
}

export function ChangeEmailCard({ currentEmail }: { currentEmail: string }) {
  const [state, formAction] = useFormState<FormResult, FormData>(
    changeEmailAction as never,
    undefined,
  );

  return (
    <GlassCard density="compact">
      <form action={formAction} className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">修改邮箱</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            邮箱仅用于登录；现有会话保持有效，下次登录请使用新邮箱。
          </p>
        </div>
        <Field label="当前邮箱">
          <TextInput value={currentEmail} readOnly disabled className="opacity-70" />
        </Field>
        <Field label="新邮箱">
          <TextInput name="newEmail" type="email" autoComplete="email" required />
        </Field>
        <Field label="当前密码">
          <TextInput name="currentPassword" type="password" autoComplete="current-password" required />
        </Field>
        <div className="flex items-center gap-3">
          <SubmitButton />
          {state && (
            <p className={state.ok ? 'text-xs text-emerald-500' : 'text-xs text-rose-500'}>
              {state.message}
            </p>
          )}
        </div>
      </form>
    </GlassCard>
  );
}
