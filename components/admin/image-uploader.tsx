'use client';

import * as React from 'react';
import { Upload, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { getMediaUploadUrl } from '@/app/admin/actions';

/**
 * Hidden text input + picker that uploads to the `media` bucket and writes
 * the resulting public URL into the named hidden input. The form will then
 * submit that URL alongside the rest of the data.
 */
export function ImageUploader({
  name,
  defaultUrl,
  folder = 'projects',
}: {
  name: string;
  defaultUrl?: string;
  folder?: string;
}) {
  const [url, setUrl] = React.useState(defaultUrl ?? '');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const key = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { token, publicUrl } = await getMediaUploadUrl(key);
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.storage.from('media').uploadToSignedUrl(key, token, file);
      if (error) throw error;
      setUrl(publicUrl);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '上传失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={url} />
      <div className="flex items-center gap-3">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="preview" className="h-16 w-16 rounded-xl object-cover" />
        ) : (
          <div className="grid h-16 w-16 place-items-center rounded-xl border border-dashed border-white/40 dark:border-white/10 text-muted-foreground">
            <ImageIcon className="h-5 w-5" />
          </div>
        )}
        <div className="space-y-1">
          <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
            <Upload className="h-3.5 w-3.5" />
            {busy ? '上传中…' : url ? '更换' : '上传图片'}
          </Button>
          <input ref={inputRef} type="file" accept="image/*" hidden onChange={onPick} />
          {err && <p className="text-xs text-rose-500">{err}</p>}
        </div>
      </div>
    </div>
  );
}
