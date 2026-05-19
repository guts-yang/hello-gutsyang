import 'server-only';

import type {
  AdminSession,
  AdminSessionListItem,
  DbExperienceRow,
  DbHonorRow,
  DbProfileRow,
  DbProjectRow,
  LocalizedJson,
  MediaUploadTicket,
  SocialJson,
} from '@/lib/api-types';
import { fetchBackendJson } from '@/lib/backend';

type LocalizedPayload = { zh: string; en: string };

type ProfilePayload = {
  id: string;
  nameZh: string;
  nameEn: string;
  handle: string;
  role: LocalizedPayload;
  slogan: LocalizedPayload;
  bio: LocalizedPayload;
  avatarUrl?: string;
  socials: SocialJson[];
  updatedAt: string;
};

type ProjectPayload = {
  id: string;
  slug: string;
  kind: 'academic' | 'engineering';
  title: LocalizedPayload;
  tagline: LocalizedPayload;
  summary: LocalizedPayload;
  tags: string[];
  highlights: LocalizedJson[];
  link?: string;
  repo?: string;
  coverUrl?: string;
  startedAt: string;
  endedAt?: string;
  displayOrder: number;
  isPublished: boolean;
};

type ExperiencePayload = {
  id: string;
  slug: string;
  org: LocalizedPayload;
  role: LocalizedPayload;
  summary: LocalizedPayload;
  metrics: LocalizedJson[];
  link?: string;
  startedAt: string;
  endedAt?: string;
  displayOrder: number;
  isPublished: boolean;
};

type HonorPayload = {
  id: string;
  pillar: 'morality' | 'wisdom' | 'athletics' | 'labor';
  title: LocalizedPayload;
  story: LocalizedPayload;
  displayOrder: number;
  isPublished: boolean;
};

export async function getAdminSession() {
  return fetchBackendJson<AdminSession>('/v1/admin/session', {}, { auth: true, revalidate: false });
}

// requireAdminSession is the shared guard used by RSC layouts and server
// actions. It performs the same Go API call that middleware.ts hits in the
// edge runtime, so all three checkpoints agree on what "authenticated" means.
// Returns the resolved session for the caller to read user info from.
export async function requireAdminSession() {
  const { redirect } = await import('next/navigation');
  const session = await getAdminSession().catch(() => ({ authenticated: false as const }) as AdminSession);
  if (!session.authenticated || !session.user) {
    redirect('/admin/login');
  }
  return session;
}

export async function getAdminProfileRow() {
  const payload = await fetchBackendJson<ProfilePayload>('/v1/admin/profile', {}, { auth: true, revalidate: false });
  return profilePayloadToRow(payload);
}

export async function listProjectRows() {
  const payload = await fetchBackendJson<ProjectPayload[]>('/v1/admin/projects', {}, { auth: true, revalidate: false });
  return payload.map(projectPayloadToRow);
}

export async function getProjectRow(id: string) {
  const payload = await fetchBackendJson<ProjectPayload>(`/v1/admin/projects/${id}`, {}, { auth: true, revalidate: false });
  return projectPayloadToRow(payload);
}

export async function listExperienceRows() {
  const payload = await fetchBackendJson<ExperiencePayload[]>('/v1/admin/experiences', {}, { auth: true, revalidate: false });
  return payload.map(experiencePayloadToRow);
}

export async function getExperienceRow(id: string) {
  const payload = await fetchBackendJson<ExperiencePayload>(`/v1/admin/experiences/${id}`, {}, { auth: true, revalidate: false });
  return experiencePayloadToRow(payload);
}

export async function listHonorRows() {
  const payload = await fetchBackendJson<HonorPayload[]>('/v1/admin/honors', {}, { auth: true, revalidate: false });
  return payload.map(honorPayloadToRow);
}

export async function getHonorRow(id: string) {
  const payload = await fetchBackendJson<HonorPayload>(`/v1/admin/honors/${id}`, {}, { auth: true, revalidate: false });
  return honorPayloadToRow(payload);
}

export async function listAdminSessions() {
  return fetchBackendJson<AdminSessionListItem[]>(
    '/v1/admin/sessions',
    {},
    { auth: true, revalidate: false },
  );
}

export type AdminAuditItem = {
  id: string;
  action: string;
  target?: string;
  ip?: string;
  userAgent?: string;
  meta?: Record<string, unknown>;
  createdAt: string;
};

export async function listAdminAudit(params?: { action?: string; before?: string; limit?: number }) {
  const search = new URLSearchParams();
  if (params?.action) search.set('action', params.action);
  if (params?.before) search.set('before', params.before);
  if (params?.limit) search.set('limit', String(params.limit));
  const qs = search.toString();
  return fetchBackendJson<AdminAuditItem[]>(
    `/v1/admin/audit${qs ? `?${qs}` : ''}`,
    {},
    { auth: true, revalidate: false },
  );
}

export async function requestMediaUpload(fileName: string, folder: string) {
  return fetchBackendJson<MediaUploadTicket>(
    '/v1/admin/media/upload-url',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fileName, folder }),
    },
    { auth: true, revalidate: false },
  );
}

export function profilePayloadToRow(payload: ProfilePayload): DbProfileRow {
  return {
    id: payload.id,
    name_zh: payload.nameZh,
    name_en: payload.nameEn,
    handle: payload.handle,
    role_zh: payload.role.zh,
    role_en: payload.role.en,
    slogan_zh: payload.slogan.zh,
    slogan_en: payload.slogan.en,
    bio_zh: payload.bio.zh,
    bio_en: payload.bio.en,
    avatar_url: payload.avatarUrl ?? null,
    socials: payload.socials,
    updated_at: payload.updatedAt,
  };
}

export function profileRowToPayload(row: DbProfileRow): ProfilePayload {
  return {
    id: row.id,
    nameZh: row.name_zh,
    nameEn: row.name_en,
    handle: row.handle,
    role: { zh: row.role_zh, en: row.role_en },
    slogan: { zh: row.slogan_zh, en: row.slogan_en },
    bio: { zh: row.bio_zh, en: row.bio_en },
    avatarUrl: row.avatar_url ?? undefined,
    socials: row.socials,
    updatedAt: row.updated_at,
  };
}

export function projectPayloadToRow(payload: ProjectPayload): DbProjectRow {
  return {
    id: payload.id,
    slug: payload.slug,
    kind: payload.kind,
    title_zh: payload.title.zh,
    title_en: payload.title.en,
    tagline_zh: payload.tagline.zh,
    tagline_en: payload.tagline.en,
    summary_zh: payload.summary.zh,
    summary_en: payload.summary.en,
    tags: payload.tags,
    highlights: payload.highlights,
    link: payload.link ?? null,
    repo: payload.repo ?? null,
    cover_url: payload.coverUrl ?? null,
    started_at: payload.startedAt,
    ended_at: payload.endedAt ?? null,
    display_order: payload.displayOrder,
    is_published: payload.isPublished,
  };
}

export function projectRowToPayload(row: DbProjectRow): ProjectPayload {
  return {
    id: row.id,
    slug: row.slug,
    kind: row.kind,
    title: { zh: row.title_zh, en: row.title_en },
    tagline: { zh: row.tagline_zh, en: row.tagline_en },
    summary: { zh: row.summary_zh, en: row.summary_en },
    tags: row.tags,
    highlights: row.highlights,
    link: row.link ?? undefined,
    repo: row.repo ?? undefined,
    coverUrl: row.cover_url ?? undefined,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    displayOrder: row.display_order,
    isPublished: row.is_published,
  };
}

export function experiencePayloadToRow(payload: ExperiencePayload): DbExperienceRow {
  return {
    id: payload.id,
    slug: payload.slug,
    org_zh: payload.org.zh,
    org_en: payload.org.en,
    role_zh: payload.role.zh,
    role_en: payload.role.en,
    summary_zh: payload.summary.zh,
    summary_en: payload.summary.en,
    metrics: payload.metrics,
    link: payload.link ?? null,
    started_at: payload.startedAt,
    ended_at: payload.endedAt ?? null,
    display_order: payload.displayOrder,
    is_published: payload.isPublished,
  };
}

export function experienceRowToPayload(row: DbExperienceRow): ExperiencePayload {
  return {
    id: row.id,
    slug: row.slug,
    org: { zh: row.org_zh, en: row.org_en },
    role: { zh: row.role_zh, en: row.role_en },
    summary: { zh: row.summary_zh, en: row.summary_en },
    metrics: row.metrics,
    link: row.link ?? undefined,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    displayOrder: row.display_order,
    isPublished: row.is_published,
  };
}

export function honorPayloadToRow(payload: HonorPayload): DbHonorRow {
  return {
    id: payload.id,
    pillar: payload.pillar,
    title_zh: payload.title.zh,
    title_en: payload.title.en,
    story_zh: payload.story.zh,
    story_en: payload.story.en,
    display_order: payload.displayOrder,
    is_published: payload.isPublished,
  };
}

export function honorRowToPayload(row: DbHonorRow): HonorPayload {
  return {
    id: row.id,
    pillar: row.pillar,
    title: { zh: row.title_zh, en: row.title_en },
    story: { zh: row.story_zh, en: row.story_en },
    displayOrder: row.display_order,
    isPublished: row.is_published,
  };
}
