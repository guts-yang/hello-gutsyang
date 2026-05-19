'use client';

import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, TextInput } from '@/components/admin/form-fields';

export type LocalizedRow = { zh: string; en: string };

export function RepeatableFieldGroup({
  name,
  label,
  rows,
  onChange,
}: {
  name: string;
  label: string;
  rows: LocalizedRow[];
  onChange: (rows: LocalizedRow[]) => void;
}) {
  const update = (index: number, patch: Partial<LocalizedRow>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const remove = (index: number) => {
    onChange(rows.filter((_, i) => i !== index));
  };

  const add = () => {
    onChange([...rows, { zh: '', en: '' }]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{label}</p>
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="h-3.5 w-3.5" />
          添加一行
        </Button>
      </div>
      <input type="hidden" name={name} value={JSON.stringify(rows)} readOnly />
      {rows.length === 0 && (
        <p className="text-xs text-muted-foreground">暂无条目，点击「添加一行」。</p>
      )}
      {rows.map((row, index) => (
        <div
          key={index}
          className="grid gap-3 rounded-2xl border border-white/30 bg-white/30 p-3 dark:border-white/10 dark:bg-white/5 sm:grid-cols-2"
        >
          <Field label={`中文 #${index + 1}`}>
            <TextInput
              value={row.zh}
              onChange={(e) => update(index, { zh: e.target.value })}
              placeholder="中文"
            />
          </Field>
          <Field label={`English #${index + 1}`}>
            <TextInput
              value={row.en}
              onChange={(e) => update(index, { en: e.target.value })}
              placeholder="English"
            />
          </Field>
          <div className="sm:col-span-2 flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => remove(index)}>
              <Trash2 className="h-3.5 w-3.5" />
              删除
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
