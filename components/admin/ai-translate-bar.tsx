'use client';

import * as React from 'react';
import { ChevronDown, ChevronRight, Languages, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { translateAdminFields } from '@/lib/admin-translate';
import type { LocalizedRow } from '@/components/admin/repeatable-field-group';

export type TranslateScalar = {
  /** form input name that carries the Chinese source value */
  zhName: string;
  /** form input name that should carry the English translation (rendered as a hidden input here) */
  enName: string;
  /** human label used in the preview panel */
  label: string;
};

export type TranslateGroup = {
  name: string;
  label: string;
  rows: LocalizedRow[];
  setRows: (rows: LocalizedRow[]) => void;
};

/**
 * AiTranslateBar is the single point of contact between admin forms and the
 * DeepSeek translation endpoint. It:
 *  - reads the current Chinese values out of the host form (via formRef)
 *  - issues one batched POST /api/admin/ai/translate
 *  - writes the English values back into hidden inputs (for scalar pairs)
 *    and the LocalizedRow[] state (for repeatable groups)
 *  - renders a collapsible preview so the admin can sanity-check before save
 *
 * Why hidden inputs for scalars: the host forms are uncontrolled (using
 * `defaultValue`) and submit via Server Actions; rendering the EN values as
 * hidden `<input name="*_en">` keeps the FormData shape backwards-compatible
 * with the existing actions.ts parsers.
 */
export function AiTranslateBar({
  formRef,
  scalars,
  groups = [],
  initialEn,
}: {
  formRef: React.RefObject<HTMLFormElement | null>;
  scalars: TranslateScalar[];
  groups?: TranslateGroup[];
  initialEn?: Record<string, string>;
}) {
  const [enValues, setEnValues] = React.useState<Record<string, string>>(initialEn ?? {});
  const [status, setStatus] = React.useState<'idle' | 'loading' | 'done' | 'error'>(
    initialEn && Object.values(initialEn).some(Boolean) ? 'done' : 'idle',
  );
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);

  async function generate() {
    setStatus('loading');
    setError(null);

    const form = formRef.current;
    if (!form) {
      setStatus('error');
      setError('表单未就绪');
      return;
    }

    // Build a flat {key -> zh} payload. Prefix scalar vs. group so the
    // response can be sliced back to the right destination after the
    // round-trip; the server treats keys as opaque strings.
    const items: Record<string, string> = {};

    for (const s of scalars) {
      const el = form.elements.namedItem(s.zhName) as HTMLInputElement | HTMLTextAreaElement | null;
      items[`scalar.${s.enName}`] = (el?.value ?? '').trim();
    }
    for (const g of groups) {
      g.rows.forEach((row, i) => {
        items[`group.${g.name}.${i}`] = (row.zh ?? '').trim();
      });
    }

    try {
      const result = await translateAdminFields(items);

      const nextEn: Record<string, string> = { ...enValues };
      for (const s of scalars) {
        nextEn[s.enName] = result[`scalar.${s.enName}`] ?? '';
      }
      setEnValues(nextEn);

      for (const g of groups) {
        const updated = g.rows.map((row, i) => ({
          ...row,
          en: result[`group.${g.name}.${i}`] ?? row.en ?? '',
        }));
        g.setRows(updated);
      }

      setStatus('done');
      setOpen(true);
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : '翻译失败');
    }
  }

  const buttonLabel =
    status === 'loading' ? '生成中…' : status === 'done' ? '重新生成英文' : 'AI 一键生成英文';

  return (
    <div className="rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50/70 to-sky-50/70 p-4 dark:border-emerald-500/20 dark:from-emerald-500/5 dark:to-sky-500/5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="text-sm font-medium">英文版本</p>
            <p className="text-xs text-muted-foreground">
              管理员只填中文；英文由 AI 一键生成（保存时也会自动兜底）
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status === 'done' && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted-foreground hover:bg-white/60 dark:hover:bg-white/10"
              aria-expanded={open}
            >
              {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {open ? '收起预览' : '查看预览'}
            </button>
          )}
          <Button
            type="button"
            variant="gradient"
            size="sm"
            onClick={generate}
            disabled={status === 'loading'}
          >
            <Languages className="mr-1 h-3.5 w-3.5" />
            {buttonLabel}
          </Button>
        </div>
      </div>

      {error && <p className="mt-2 text-xs text-rose-500">{error}</p>}

      {scalars.map((s) => (
        <input
          key={s.enName}
          type="hidden"
          name={s.enName}
          value={enValues[s.enName] ?? ''}
          readOnly
        />
      ))}

      {open && status === 'done' && (
        <div className="mt-3 space-y-2 rounded-xl bg-white/70 p-3 text-xs dark:bg-white/5">
          {scalars.map((s) => (
            <div key={s.enName}>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
              <p className="mt-0.5 whitespace-pre-wrap text-foreground/90">
                {enValues[s.enName] || <span className="text-muted-foreground">（空）</span>}
              </p>
            </div>
          ))}
          {groups.map((g) => (
            <div key={g.name}>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{g.label}</p>
              {g.rows.length === 0 ? (
                <p className="text-muted-foreground">（无条目）</p>
              ) : (
                <ol className="mt-0.5 list-decimal space-y-0.5 pl-5">
                  {g.rows.map((row, i) => (
                    <li key={i} className="text-foreground/90">
                      {row.en || <span className="text-muted-foreground">（空）</span>}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
