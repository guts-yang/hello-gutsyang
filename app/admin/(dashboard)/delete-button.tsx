'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function DeleteButton({
  id,
  action,
}: {
  id: string;
  action: (id: string) => Promise<void>;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => {
        if (!confirm('确认删除？此操作不可恢复。')) return;
        start(async () => {
          await action(id);
          router.refresh();
        });
      }}
    >
      <Trash2 className="h-3.5 w-3.5" />
      删除
    </Button>
  );
}
