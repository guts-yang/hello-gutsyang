'use client';

import * as React from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { GlassCard } from '@/components/glass-card';
import { Button } from '@/components/ui/button';
import { Field, TextInput, TextArea, Switch } from '@/components/admin/form-fields';
import { RepeatableFieldGroup, type LocalizedRow } from '@/components/admin/repeatable-field-group';
import { ImageUploader } from '@/components/admin/image-uploader';
import { AiTranslateBar } from '@/components/admin/ai-translate-bar';
import { saveProject } from '@/app/admin/actions';
import type { DbProjectRow } from '@/lib/api-types';

type FormResult = { ok: boolean; message: string } | undefined;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="gradient" disabled={pending}>
      {pending ? '保存中…' : '保存'}
    </Button>
  );
}

export function ProjectForm({ row }: { row?: DbProjectRow }) {
  const [state, formAction] = useFormState<FormResult, FormData>(saveProject as never, undefined);
  const [highlights, setHighlights] = React.useState<LocalizedRow[]>(
    () => (row?.highlights as LocalizedRow[]) ?? [],
  );
  const formRef = React.useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={formAction} className="space-y-5">
      {row && <input type="hidden" name="id" value={row.id} />}

      <AiTranslateBar
        formRef={formRef}
        scalars={[
          { zhName: 'title_zh', enName: 'title_en', label: '标题' },
          { zhName: 'tagline_zh', enName: 'tagline_en', label: '一句话' },
          { zhName: 'summary_zh', enName: 'summary_en', label: '简介' },
        ]}
        groups={[
          { name: 'highlights', label: '亮点 Highlights', rows: highlights, setRows: setHighlights },
        ]}
        initialEn={{
          title_en: row?.title_en ?? '',
          tagline_en: row?.tagline_en ?? '',
          summary_en: row?.summary_en ?? '',
        }}
      />

      <GlassCard>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Slug" hint="URL 标识（语言无关）">
            <TextInput name="slug" defaultValue={row?.slug} required />
          </Field>
          <Field label="Kind">
            <select
              name="kind"
              defaultValue={row?.kind ?? 'engineering'}
              className="h-10 w-full rounded-2xl border border-white/40 dark:border-white/10 bg-white/40 dark:bg-white/5 px-4 text-sm outline-none"
            >
              <option value="engineering">engineering</option>
              <option value="academic">academic</option>
            </select>
          </Field>
          <Field label="标题（中文）">
            <TextInput name="title_zh" defaultValue={row?.title_zh} required />
          </Field>
          <Field label="一句话（中文）">
            <TextInput name="tagline_zh" defaultValue={row?.tagline_zh} />
          </Field>
          <Field label="简介（中文）" className="sm:col-span-2">
            <TextArea name="summary_zh" defaultValue={row?.summary_zh} rows={4} />
          </Field>
          <Field
            label="标签（用逗号分隔）"
            className="sm:col-span-2"
            hint="技术 keyword 通常本身就是英文专有名词，如：LLM, PyTorch, NeurIPS"
          >
            <TextInput name="tags" defaultValue={row?.tags?.join(', ') ?? ''} />
          </Field>
          <div className="sm:col-span-2">
            <RepeatableFieldGroup
              name="highlights"
              label="亮点 Highlights（中文）"
              rows={highlights}
              onChange={setHighlights}
            />
          </div>
          <Field label="Repo URL">
            <TextInput name="repo" type="url" defaultValue={row?.repo ?? ''} />
          </Field>
          <Field label="Live URL">
            <TextInput name="link" type="url" defaultValue={row?.link ?? ''} />
          </Field>
          <Field label="封面图" className="sm:col-span-2">
            <ImageUploader name="cover_url" defaultUrl={row?.cover_url ?? ''} folder="projects" />
          </Field>
          <Field label="开始日期">
            <TextInput type="date" name="started_at" defaultValue={row?.started_at?.slice(0, 10)} required />
          </Field>
          <Field label="结束日期">
            <TextInput type="date" name="ended_at" defaultValue={row?.ended_at?.slice(0, 10) ?? ''} />
          </Field>
          <Field label="排序">
            <TextInput type="number" name="display_order" defaultValue={row?.display_order ?? 0} />
          </Field>
          <Field label="发布">
            <Switch name="is_published" defaultChecked={row?.is_published ?? true} />
          </Field>
        </div>
      </GlassCard>

      <div className="flex items-center gap-3">
        <SubmitButton />
        {state?.ok === false && <p className="text-xs text-rose-500">{state.message}</p>}
      </div>
    </form>
  );
}
