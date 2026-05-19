'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import type { AdminActionResult } from '@/lib/admin-action-result';

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="gradient" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function AdminFormShell({
  formAction,
  cancelHref,
  children,
  state,
  submitLabel = '保存',
  pendingLabel = '保存中…',
}: {
  formAction: (payload: FormData) => void;
  cancelHref: string;
  children: ReactNode;
  state?: AdminActionResult;
  submitLabel?: string;
  pendingLabel?: string;
}) {
  return (
    <form action={formAction} className="space-y-6">
      {state?.ok === false && (
        <div className="rounded-2xl border border-rose-300/40 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-200">
          {state.message}
        </div>
      )}
      {state?.ok === true && state.message && (
        <div className="rounded-2xl border border-emerald-300/40 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-200">
          {state.message}
        </div>
      )}
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton label={submitLabel} pendingLabel={pendingLabel} />
        <Button type="button" variant="outline" asChild>
          <Link href={cancelHref}>取消</Link>
        </Button>
      </div>
    </form>
  );
}
