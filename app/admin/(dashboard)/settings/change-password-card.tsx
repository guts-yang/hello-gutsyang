'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { GlassCard } from '@/components/glass-card';
import { Button } from '@/components/ui/button';
import { Field, TextInput } from '@/components/admin/form-fields';
import { changePasswordAction } from './actions';

type FormResult = { ok: boolean; message: string } | undefined;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="gradient" disabled={pending}>
      {pending ? '保存中…' : '更新密码'}
    </Button>
  );
}

export function ChangePasswordCard() {
  const [state, formAction] = useFormState<FormResult, FormData>(
    changePasswordAction as never,
    undefined,
  );

  return (
    <GlassCard density="compact">
      <form action={formAction} className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">修改密码</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            成功后会自动撤销其它设备上的会话；当前浏览器保持登录。
          </p>
        </div>
        <Field label="当前密码">
          <TextInput name="currentPassword" type="password" autoComplete="current-password" required />
        </Field>
        <Field label="新密码" hint="至少 8 位">
          <TextInput name="newPassword" type="password" autoComplete="new-password" minLength={8} required />
        </Field>
        <Field label="确认新密码">
          <TextInput name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required />
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
