'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  experienceRowToPayload,
  honorRowToPayload,
  profileRowToPayload,
  projectRowToPayload,
  requireAdminSession,
} from '@/lib/admin-api';
import type {
  DbExperienceRow,
  DbHonorRow,
  DbProfileRow,
  DbProjectRow,
  LocalizedJson,
  SocialJson,
} from '@/lib/api-types';
import { fetchBackend } from '@/lib/backend';

type LocalizedRow = LocalizedJson;
import { optionalUrl } from '@/lib/admin-zod';
import type { AdminActionResult } from '@/lib/admin-action-result';
import { actionError } from '@/lib/admin-action-result';

function readFormString(fd: FormData, key: string, fallback = ''): string {
  const v = fd.get(key);
  return typeof v === 'string' ? v : fallback;
}

function readFormBool(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === 'on' || v === 'true' || v === '1';
}

function readFormJson<T = unknown>(fd: FormData, key: string, fallback: T): T {
  const v = fd.get(key);
  if (typeof v !== 'string' || v.trim() === '') return fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

async function assertAdminSession() {
  await requireAdminSession();
}

function revalidateContent() {
  revalidatePath('/zh');
  revalidatePath('/en');
  revalidatePath('/admin', 'layout');
}

// EnsurePair is the unit of work for ensureEnglish: each entry maps a stable
// key (used only for the round-trip) to its current zh source + current en
// value. When `en` is empty but `zh` is not we ask the Go translate endpoint
// to fill the blank; otherwise we keep what the user (or AiTranslateBar)
// already supplied.
type EnsurePair = { key: string; zh: string; en: string };

// ensureEnglish is the server-side safety net for the "admin only types in
// Chinese" flow. Even if the admin forgets to click "AI 一键生成英文",
// we will not save a half-localised row -- this helper backfills every
// missing English field via /v1/admin/ai/translate before the row is
// persisted. Translation failures are non-fatal so a flaky DeepSeek does
// not block content updates: the worst case is an empty `en` field that
// the admin can re-translate later.
async function ensureEnglish(pairs: EnsurePair[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const p of pairs) out[p.key] = p.en;

  const missing: Record<string, string> = {};
  for (const p of pairs) {
    if (p.en.trim() === '' && p.zh.trim() !== '') {
      missing[p.key] = p.zh;
    }
  }
  if (Object.keys(missing).length === 0) return out;

  let response: Response;
  try {
    response = await fetchBackend(
      '/v1/admin/ai/translate',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items: missing }),
      },
      { auth: true, revalidate: false, timeoutMs: 30_000 },
    );
  } catch {
    return out;
  }
  if (response.ok) {
    const data = (await response.json().catch(() => ({}))) as { items?: Record<string, string> };
    const translated = data.items ?? {};
    for (const key of Object.keys(missing)) {
      if (translated[key]) out[key] = translated[key];
    }
  }
  // Last-resort fallback: if translation still left a required en blank, copy
  // the zh source over so downstream schema.parse(min(1)) does not reject the
  // whole save. The /en route will fall back to Chinese for that field, but
  // the row still persists and the admin can retry the translate button.
  for (const p of pairs) {
    if (out[p.key].trim() === '' && p.zh.trim() !== '') {
      out[p.key] = p.zh;
    }
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────────────
// Profile
// ──────────────────────────────────────────────────────────────────────────────

const ProfileSchema = z.object({
  name_zh: z.string().min(1),
  name_en: z.string().min(1),
  handle: z.string().min(1),
  role_zh: z.string(),
  role_en: z.string(),
  slogan_zh: z.string(),
  slogan_en: z.string(),
  bio_zh: z.string(),
  bio_en: z.string(),
  avatar_url: z.string().nullable().optional(),
});

const SocialsSchema = z.array(
  z.object({
    type: z.enum(['github', 'wechat', 'linkedin', 'twitter']),
    href: z.string().min(1),
    label: z.string().optional(),
  }),
);

export async function saveProfile(_: unknown, fd: FormData) {
  await assertAdminSession();
  const raw = {
    name_zh: readFormString(fd, 'name_zh'),
    name_en: readFormString(fd, 'name_en'),
    handle: readFormString(fd, 'handle'),
    role_zh: readFormString(fd, 'role_zh'),
    role_en: readFormString(fd, 'role_en'),
    slogan_zh: readFormString(fd, 'slogan_zh'),
    slogan_en: readFormString(fd, 'slogan_en'),
    bio_zh: readFormString(fd, 'bio_zh'),
    bio_en: readFormString(fd, 'bio_en'),
    avatar_url: readFormString(fd, 'avatar_url') || null,
  };
  const filled = await ensureEnglish([
    { key: 'name_en', zh: raw.name_zh, en: raw.name_en },
    { key: 'role_en', zh: raw.role_zh, en: raw.role_en },
    { key: 'slogan_en', zh: raw.slogan_zh, en: raw.slogan_en },
    { key: 'bio_en', zh: raw.bio_zh, en: raw.bio_en },
  ]);
  const data = ProfileSchema.parse({
    ...raw,
    name_en: filled.name_en,
    role_en: filled.role_en,
    slogan_en: filled.slogan_en,
    bio_en: filled.bio_en,
  });
  let socials: SocialJson[];
  try {
    socials = SocialsSchema.parse(readFormJson(fd, 'socials', []));
  } catch {
    return { ok: false as const, message: 'Socials JSON 格式无效，仅支持 github / wechat / linkedin / twitter' };
  }
  const row: DbProfileRow = {
    id: 'main',
    ...data,
    avatar_url: data.avatar_url ?? null,
    socials,
    updated_at: new Date().toISOString(),
  };
  const payload = profileRowToPayload(row);
  const response = await fetchBackend(
    '/v1/admin/profile',
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    },
    { auth: true, revalidate: false },
  );
  if (!response.ok) {
    const text = await response.text().catch(() => '保存失败');
    return { ok: false as const, message: text };
  }
  revalidateContent();
  return { ok: true as const, message: '已保存' };
}

// ──────────────────────────────────────────────────────────────────────────────
// Projects
// ──────────────────────────────────────────────────────────────────────────────

const ProjectSchema = z.object({
  slug: z.string().min(1),
  kind: z.enum(['academic', 'engineering']),
  title_zh: z.string().min(1),
  title_en: z.string().min(1),
  tagline_zh: z.string(),
  tagline_en: z.string(),
  summary_zh: z.string(),
  summary_en: z.string(),
  link: optionalUrl.optional(),
  repo: optionalUrl.optional(),
  cover_url: z.string().nullable().optional(),
  started_at: z.string().min(1),
  ended_at: z.string().nullable().optional(),
  display_order: z.coerce.number().int(),
  is_published: z.boolean(),
});

export async function saveProject(_: unknown, fd: FormData) {
  await assertAdminSession();
  const id = readFormString(fd, 'id') || null;
  const raw = {
    slug: readFormString(fd, 'slug'),
    kind: readFormString(fd, 'kind') as 'academic' | 'engineering',
    title_zh: readFormString(fd, 'title_zh'),
    title_en: readFormString(fd, 'title_en'),
    tagline_zh: readFormString(fd, 'tagline_zh'),
    tagline_en: readFormString(fd, 'tagline_en'),
    summary_zh: readFormString(fd, 'summary_zh'),
    summary_en: readFormString(fd, 'summary_en'),
    link: readFormString(fd, 'link') || null,
    repo: readFormString(fd, 'repo') || null,
    cover_url: readFormString(fd, 'cover_url') || null,
    started_at: readFormString(fd, 'started_at'),
    ended_at: readFormString(fd, 'ended_at') || null,
    display_order: readFormString(fd, 'display_order', '0'),
    is_published: readFormBool(fd, 'is_published'),
  };
  const highlightsRaw = readFormJson<LocalizedRow[]>(fd, 'highlights', []);
  const filled = await ensureEnglish([
    { key: 'title_en', zh: raw.title_zh, en: raw.title_en },
    { key: 'tagline_en', zh: raw.tagline_zh, en: raw.tagline_en },
    { key: 'summary_en', zh: raw.summary_zh, en: raw.summary_en },
    ...highlightsRaw.map((row, i) => ({
      key: `highlight.${i}`,
      zh: row?.zh ?? '',
      en: row?.en ?? '',
    })),
  ]);
  const data = ProjectSchema.parse({
    ...raw,
    title_en: filled.title_en,
    tagline_en: filled.tagline_en,
    summary_en: filled.summary_en,
  });
  const tags = readFormString(fd, 'tags')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  const highlights = highlightsRaw.map((row, i) => ({
    zh: row?.zh ?? '',
    en: filled[`highlight.${i}`] ?? row?.en ?? '',
  }));
  const row: DbProjectRow = {
    id: id ?? '',
    ...data,
    link: data.link ?? null,
    repo: data.repo ?? null,
    cover_url: data.cover_url ?? null,
    ended_at: data.ended_at ?? null,
    tags,
    highlights: highlights as DbProjectRow['highlights'],
  };
  const payload = projectRowToPayload(row);
  const response = await fetchBackend(
    id ? `/v1/admin/projects/${id}` : '/v1/admin/projects',
    {
      method: id ? 'PUT' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    },
    { auth: true, revalidate: false },
  );
  if (!response.ok) {
    const text = await response.text().catch(() => '保存失败');
    return { ok: false as const, message: text };
  }

  revalidateContent();
  redirect('/admin/projects?saved=1');
}

export async function deleteProject(id: string): Promise<AdminActionResult> {
  await assertAdminSession();
  const response = await fetchBackend(
    `/v1/admin/projects/${id}`,
    { method: 'DELETE' },
    { auth: true, revalidate: false },
  );
  if (!response.ok) {
    return actionError((await response.text().catch(() => '')) || '删除失败');
  }
  revalidateContent();
  return { ok: true };
}

// ──────────────────────────────────────────────────────────────────────────────
// Experiences
// ──────────────────────────────────────────────────────────────────────────────

const ExperienceSchema = z.object({
  slug: z.string().min(1),
  org_zh: z.string().min(1),
  org_en: z.string().min(1),
  role_zh: z.string(),
  role_en: z.string(),
  summary_zh: z.string(),
  summary_en: z.string(),
  link: optionalUrl.optional(),
  started_at: z.string().min(1),
  ended_at: z.string().nullable().optional(),
  display_order: z.coerce.number().int(),
  is_published: z.boolean(),
});

export async function saveExperience(_: unknown, fd: FormData) {
  await assertAdminSession();
  const id = readFormString(fd, 'id') || null;
  const raw = {
    slug: readFormString(fd, 'slug'),
    org_zh: readFormString(fd, 'org_zh'),
    org_en: readFormString(fd, 'org_en'),
    role_zh: readFormString(fd, 'role_zh'),
    role_en: readFormString(fd, 'role_en'),
    summary_zh: readFormString(fd, 'summary_zh'),
    summary_en: readFormString(fd, 'summary_en'),
    link: readFormString(fd, 'link') || null,
    started_at: readFormString(fd, 'started_at'),
    ended_at: readFormString(fd, 'ended_at') || null,
    display_order: readFormString(fd, 'display_order', '0'),
    is_published: readFormBool(fd, 'is_published'),
  };
  const metricsRaw = readFormJson<LocalizedRow[]>(fd, 'metrics', []);
  const filled = await ensureEnglish([
    { key: 'org_en', zh: raw.org_zh, en: raw.org_en },
    { key: 'role_en', zh: raw.role_zh, en: raw.role_en },
    { key: 'summary_en', zh: raw.summary_zh, en: raw.summary_en },
    ...metricsRaw.map((row, i) => ({
      key: `metric.${i}`,
      zh: row?.zh ?? '',
      en: row?.en ?? '',
    })),
  ]);
  const data = ExperienceSchema.parse({
    ...raw,
    org_en: filled.org_en,
    role_en: filled.role_en,
    summary_en: filled.summary_en,
  });
  const metrics = metricsRaw.map((row, i) => ({
    zh: row?.zh ?? '',
    en: filled[`metric.${i}`] ?? row?.en ?? '',
  }));
  const row: DbExperienceRow = {
    id: id ?? '',
    ...data,
    link: data.link ?? null,
    ended_at: data.ended_at ?? null,
    metrics: metrics as DbExperienceRow['metrics'],
  };
  const payload = experienceRowToPayload(row);
  const response = await fetchBackend(
    id ? `/v1/admin/experiences/${id}` : '/v1/admin/experiences',
    {
      method: id ? 'PUT' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    },
    { auth: true, revalidate: false },
  );
  if (!response.ok) {
    const text = await response.text().catch(() => '保存失败');
    return { ok: false as const, message: text };
  }

  revalidateContent();
  redirect('/admin/experiences?saved=1');
}

export async function deleteExperience(id: string): Promise<AdminActionResult> {
  await assertAdminSession();
  const response = await fetchBackend(
    `/v1/admin/experiences/${id}`,
    { method: 'DELETE' },
    { auth: true, revalidate: false },
  );
  if (!response.ok) {
    return actionError((await response.text().catch(() => '')) || '删除失败');
  }
  revalidateContent();
  return { ok: true };
}

// ──────────────────────────────────────────────────────────────────────────────
// Honors
// ──────────────────────────────────────────────────────────────────────────────

const HonorSchema = z.object({
  pillar: z.enum(['morality', 'wisdom', 'athletics', 'labor']),
  title_zh: z.string().min(1),
  title_en: z.string().min(1),
  story_zh: z.string(),
  story_en: z.string(),
  display_order: z.coerce.number().int(),
  is_published: z.boolean(),
});

export async function saveHonor(_: unknown, fd: FormData) {
  await assertAdminSession();
  const id = readFormString(fd, 'id') || null;
  const raw = {
    pillar: readFormString(fd, 'pillar') as 'morality' | 'wisdom' | 'athletics' | 'labor',
    title_zh: readFormString(fd, 'title_zh'),
    title_en: readFormString(fd, 'title_en'),
    story_zh: readFormString(fd, 'story_zh'),
    story_en: readFormString(fd, 'story_en'),
    display_order: readFormString(fd, 'display_order', '0'),
    is_published: readFormBool(fd, 'is_published'),
  };
  const filled = await ensureEnglish([
    { key: 'title_en', zh: raw.title_zh, en: raw.title_en },
    { key: 'story_en', zh: raw.story_zh, en: raw.story_en },
  ]);
  const data = HonorSchema.parse({
    ...raw,
    title_en: filled.title_en,
    story_en: filled.story_en,
  });

  const payload = honorRowToPayload({
    id: id ?? '',
    ...data,
  } satisfies DbHonorRow);
  const response = await fetchBackend(
    id ? `/v1/admin/honors/${id}` : '/v1/admin/honors',
    {
      method: id ? 'PUT' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    },
    { auth: true, revalidate: false },
  );
  if (!response.ok) {
    const text = await response.text().catch(() => '保存失败');
    return { ok: false as const, message: text };
  }

  revalidateContent();
  redirect('/admin/honors?saved=1');
}

export async function deleteHonor(id: string): Promise<AdminActionResult> {
  await assertAdminSession();
  const response = await fetchBackend(
    `/v1/admin/honors/${id}`,
    { method: 'DELETE' },
    { auth: true, revalidate: false },
  );
  if (!response.ok) {
    return actionError((await response.text().catch(() => '')) || '删除失败');
  }
  revalidateContent();
  return { ok: true };
}

// ──────────────────────────────────────────────────────────────────────────────
// Image upload (used by the form via the browser client; this action just
// returns a signed-upload URL for the chosen path.)
// ──────────────────────────────────────────────────────────────────────────────

export async function getMediaUploadUrl(path: string) {
  await assertAdminSession();
  const parts = path.split('/');
  const fileName = parts.pop() || path;
  const folder = parts.join('/') || 'projects';
  const response = await fetchBackend(
    '/v1/admin/media/upload-url',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fileName, folder }),
    },
    { auth: true, revalidate: false },
  );
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as { uploadUrl: string; publicUrl: string };
}
