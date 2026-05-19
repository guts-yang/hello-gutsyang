'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AdminActionResult } from '@/lib/admin-action-result';

export function DeleteButton({
  id,
  action,
}: {
  id: string;
  action: (id: string) => Promise<AdminActionResult>;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => {
          if (!confirm('确认删除？此操作不可恢复。')) return;
          setError(null);
          start(async () => {
            try {
              const result = await action(id);
              if (!result.ok) {
                setError(result.message);
                return;
              }
              router.refresh();
            } catch (err: unknown) {
              setError(err instanceof Error ? err.message : '删除失败');
            }
          });
        }}
      >
        <Trash2 className="h-3.5 w-3.5" />
        {pending ? '删除中…' : '删除'}
      </Button>
      {error && <p className="text-xs text-rose-500">{error}</p>}
    </div>
  );
}
