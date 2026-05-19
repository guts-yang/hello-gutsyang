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
  SocialJson,
} from '@/lib/api-types';
import { fetchBackend } from '@/lib/backend';

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

<<<<<<< Updated upstream
async function requireAdmin() {
  const supabase = createSupabaseServerClient();
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login');
  return supabase;
=======
async function assertAdminSession() {
  await requireAdminSession();
>>>>>>> Stashed changes
}

function revalidateAll() {
  revalidatePath('/', 'layout');
  revalidatePath('/zh');
  revalidatePath('/en');
  revalidatePath('/admin', 'layout');
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
  const data = ProfileSchema.parse({
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
  revalidateAll();
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
  link: z.string().url().nullable().optional(),
  repo: z.string().url().nullable().optional(),
  cover_url: z.string().nullable().optional(),
  started_at: z.string().min(1),
  ended_at: z.string().nullable().optional(),
  display_order: z.coerce.number().int(),
  is_published: z.boolean(),
});

export async function saveProject(_: unknown, fd: FormData) {
  await assertAdminSession();
  const id = readFormString(fd, 'id') || null;
  const data = ProjectSchema.parse({
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
  });
  const tags = readFormString(fd, 'tags')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  const highlights = readFormJson(fd, 'highlights', [] as unknown[]);
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

  revalidateAll();
  redirect('/admin/projects');
}

export async function deleteProject(id: string) {
  await assertAdminSession();
  const response = await fetchBackend(
    `/v1/admin/projects/${id}`,
    { method: 'DELETE' },
    { auth: true, revalidate: false },
  );
  if (!response.ok) throw new Error(await response.text());
  revalidateAll();
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
  link: z.string().url().nullable().optional(),
  started_at: z.string().min(1),
  ended_at: z.string().nullable().optional(),
  display_order: z.coerce.number().int(),
  is_published: z.boolean(),
});

export async function saveExperience(_: unknown, fd: FormData) {
  await assertAdminSession();
  const id = readFormString(fd, 'id') || null;
  const data = ExperienceSchema.parse({
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
  });
  const metrics = readFormJson(fd, 'metrics', [] as unknown[]);
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

  revalidateAll();
  redirect('/admin/experiences');
}

export async function deleteExperience(id: string) {
  await assertAdminSession();
  const response = await fetchBackend(
    `/v1/admin/experiences/${id}`,
    { method: 'DELETE' },
    { auth: true, revalidate: false },
  );
  if (!response.ok) throw new Error(await response.text());
  revalidateAll();
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
  const data = HonorSchema.parse({
    pillar: readFormString(fd, 'pillar') as 'morality' | 'wisdom' | 'athletics' | 'labor',
    title_zh: readFormString(fd, 'title_zh'),
    title_en: readFormString(fd, 'title_en'),
    story_zh: readFormString(fd, 'story_zh'),
    story_en: readFormString(fd, 'story_en'),
    display_order: readFormString(fd, 'display_order', '0'),
    is_published: readFormBool(fd, 'is_published'),
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

  revalidateAll();
  redirect('/admin/honors');
}

export async function deleteHonor(id: string) {
  await assertAdminSession();
  const response = await fetchBackend(
    `/v1/admin/honors/${id}`,
    { method: 'DELETE' },
    { auth: true, revalidate: false },
  );
  if (!response.ok) throw new Error(await response.text());
  revalidateAll();
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
