'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function AdminDashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[admin]', error);
  }, [error]);

  return (
    <div className="glass rounded-3xl p-8 text-center space-y-4">
      <h2 className="text-lg font-semibold">后台加载失败</h2>
      <p className="text-sm text-muted-foreground">
        请确认 Go API 已启动（npm run dev:backend），然后重试。
      </p>
      <Button type="button" variant="gradient" onClick={reset}>
        重试
      </Button>
    </div>
  );
}
