'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/admin-api';
import { fetchBackend } from '@/lib/backend';

// All actions below funnel admin-only mutations through the Go API. Each one
// (a) re-asserts the session via requireAdminSession() to redirect anonymous
// callers, (b) returns a discriminated `{ ok, message }` for the form UI to
// render inline, and (c) revalidates the settings page so the sessions list
// refreshes after a kick.

type ActionResult = { ok: true; message: string } | { ok: false; message: string };

const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, '请输入当前密码'),
    newPassword: z.string().min(8, '新密码至少 8 位'),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: '两次输入的新密码不一致',
  });

export async function changePasswordAction(_: unknown, fd: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const parsed = ChangePasswordSchema.safeParse({
    currentPassword: String(fd.get('currentPassword') ?? ''),
    newPassword: String(fd.get('newPassword') ?? ''),
    confirmPassword: String(fd.get('confirmPassword') ?? ''),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? '表单校验失败' };
  }

  const response = await fetchBackend(
    '/v1/admin/password',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
      }),
    },
    { auth: true, revalidate: false },
  );
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    return { ok: false, message: payload?.message ?? '修改失败' };
  }
  revalidatePath('/admin/settings');
  return { ok: true, message: '密码已更新，其他设备已被强制退出' };
}

const ChangeEmailSchema = z.object({
  currentPassword: z.string().min(1, '请输入当前密码'),
  newEmail: z.string().email('请输入有效的邮箱'),
});

export async function changeEmailAction(_: unknown, fd: FormData): Promise<ActionResult> {
  await requireAdminSession();
  const parsed = ChangeEmailSchema.safeParse({
    currentPassword: String(fd.get('currentPassword') ?? ''),
    newEmail: String(fd.get('newEmail') ?? ''),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? '表单校验失败' };
  }

  const response = await fetchBackend(
    '/v1/admin/email',
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(parsed.data),
    },
    { auth: true, revalidate: false },
  );
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    return { ok: false, message: payload?.message ?? '修改失败' };
  }
  revalidatePath('/admin/settings');
  revalidatePath('/admin', 'layout');
  return { ok: true, message: '邮箱已更新' };
}

export async function revokeSessionAction(id: string): Promise<ActionResult> {
  await requireAdminSession();
  const response = await fetchBackend(
    `/v1/admin/sessions/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
    { auth: true, revalidate: false },
  );
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    return { ok: false, message: payload?.message ?? '撤销失败' };
  }
  revalidatePath('/admin/settings');
  return { ok: true, message: '已踢出该会话' };
}

export async function revokeAllOtherSessionsAction(): Promise<ActionResult> {
  await requireAdminSession();
  const response = await fetchBackend(
    '/v1/admin/sessions/revoke-all',
    { method: 'POST' },
    { auth: true, revalidate: false },
  );
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    return { ok: false, message: payload?.message ?? '撤销失败' };
  }
  const payload = (await response.json().catch(() => null)) as { revoked?: number } | null;
  revalidatePath('/admin/settings');
  return { ok: true, message: `已踢出 ${payload?.revoked ?? 0} 个会话` };
}
