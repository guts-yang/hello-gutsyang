import 'server-only';
import { createSupabaseAnonClient } from '@/lib/supabase/server';
import {
  profile as staticProfile,
  projects as staticProjects,
  experiences as staticExperiences,
  honors as staticHonors,
  education as staticEducation,
  timeline as staticTimeline,
  type Project,
  type Experience,
  type Honor,
  type Education,
  type LocalizedString,
} from '@/lib/profile';
import type {
  DbExperienceRow,
  DbHonorRow,
  DbEducationRow,
  DbProfileRow,
  DbProjectRow,
  DbTimelineRow,
  SocialJson,
} from '@/lib/supabase/types';

/**
 * Content reader: tries Supabase first; falls back to the static seed in
 * lib/profile.ts when the project isn't yet wired up. This keeps `npm run dev`
 * working out-of-the-box and lets the CMS replace data over time.
 */

export type ProfileBundle = {
  nameZh: string;
  nameEn: string;
  handle: string;
  role: LocalizedString;
  slogan: LocalizedString;
  bio: LocalizedString;
  avatarUrl?: string;
  socials: SocialJson[];
};

export type TimelineEvent = {
  date: string;
  kind: 'edu' | 'work' | 'project' | 'honor';
  title: LocalizedString;
  body: LocalizedString;
};

const REVALIDATE_SECONDS = 60;

function fromProjectRow(row: DbProjectRow): Project {
  return {
    slug: row.slug,
    kind: row.kind,
    title: { zh: row.title_zh, en: row.title_en },
    tagline: { zh: row.tagline_zh, en: row.tagline_en },
    summary: { zh: row.summary_zh, en: row.summary_en },
    tags: row.tags ?? [],
    highlights: row.highlights ?? [],
    link: row.link ?? undefined,
    repo: row.repo ?? undefined,
    cover: row.cover_url ?? undefined,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
  };
}

function fromExperienceRow(row: DbExperienceRow): Experience {
  return {
    slug: row.slug,
    org: { zh: row.org_zh, en: row.org_en },
    role: { zh: row.role_zh, en: row.role_en },
    summary: { zh: row.summary_zh, en: row.summary_en },
    metrics: row.metrics ?? [],
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    link: row.link ?? undefined,
  };
}

function fromHonorRow(row: DbHonorRow): Honor {
  return {
    pillar: row.pillar,
    title: { zh: row.title_zh, en: row.title_en },
    story: { zh: row.story_zh, en: row.story_en },
  };
}

function fromEducationRow(row: DbEducationRow): Education {
  return {
    school: { zh: row.school_zh, en: row.school_en },
    degree: { zh: row.degree_zh, en: row.degree_en },
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    notes:
      row.notes_zh || row.notes_en
        ? { zh: row.notes_zh ?? '', en: row.notes_en ?? '' }
        : undefined,
  };
}

function fromTimelineRow(row: DbTimelineRow): TimelineEvent {
  return {
    date: row.date,
    kind: row.kind,
    title: { zh: row.title_zh, en: row.title_en },
    body: { zh: row.body_zh, en: row.body_en },
  };
}

function fromProfileRow(row: DbProfileRow): ProfileBundle {
  return {
    nameZh: row.name_zh,
    nameEn: row.name_en,
    handle: row.handle,
    role: { zh: row.role_zh, en: row.role_en },
    slogan: { zh: row.slogan_zh, en: row.slogan_en },
    bio: { zh: row.bio_zh, en: row.bio_en },
    avatarUrl: row.avatar_url ?? undefined,
    socials: row.socials ?? [],
  };
}

const staticProfileBundle: ProfileBundle = {
  nameZh: staticProfile.nameZh,
  nameEn: staticProfile.nameEn,
  handle: staticProfile.handle,
  role: staticProfile.role,
  slogan: staticProfile.slogan,
  bio: staticProfile.bio,
  avatarUrl: staticProfile.avatarUrl,
  socials: staticProfile.socials as unknown as SocialJson[],
};

export async function getProfile(): Promise<ProfileBundle> {
  const sb = createSupabaseAnonClient();
  if (!sb) return staticProfileBundle;
  const { data, error } = await sb
    .from('profile')
    .select('*')
    .eq('id', 'main')
    .maybeSingle();
  if (error || !data) return staticProfileBundle;
  return fromProfileRow(data as DbProfileRow);
}

export async function getProjects(): Promise<Project[]> {
  const sb = createSupabaseAnonClient();
  if (!sb) return staticProjects;
  const { data, error } = await sb
    .from('projects')
    .select('*')
    .eq('is_published', true)
    .order('display_order', { ascending: false })
    .order('started_at', { ascending: false });
  if (error || !data || data.length === 0) return staticProjects;
  return (data as DbProjectRow[]).map(fromProjectRow);
}

export async function getProjectBySlug(slug: string): Promise<Project | undefined> {
  const all = await getProjects();
  return all.find((p) => p.slug === slug);
}

export async function getExperiences(): Promise<Experience[]> {
  const sb = createSupabaseAnonClient();
  if (!sb) return staticExperiences;
  const { data, error } = await sb
    .from('experiences')
    .select('*')
    .eq('is_published', true)
    .order('display_order', { ascending: false })
    .order('started_at', { ascending: false });
  if (error || !data || data.length === 0) return staticExperiences;
  return (data as DbExperienceRow[]).map(fromExperienceRow);
}

export async function getExperienceBySlug(slug: string): Promise<Experience | undefined> {
  const all = await getExperiences();
  return all.find((e) => e.slug === slug);
}

export async function getHonors(): Promise<Honor[]> {
  const sb = createSupabaseAnonClient();
  if (!sb) return staticHonors;
  const { data, error } = await sb
    .from('honors')
    .select('*')
    .eq('is_published', true)
    .order('display_order', { ascending: false });
  if (error || !data || data.length === 0) return staticHonors;
  return (data as DbHonorRow[]).map(fromHonorRow);
}

export async function getEducation(): Promise<Education[]> {
  const sb = createSupabaseAnonClient();
  if (!sb) return staticEducation;
  const { data, error } = await sb
    .from('education')
    .select('*')
    .order('display_order', { ascending: false });
  if (error || !data || data.length === 0) return staticEducation;
  return (data as DbEducationRow[]).map(fromEducationRow);
}

export async function getTimeline(): Promise<TimelineEvent[]> {
  const sb = createSupabaseAnonClient();
  if (!sb) return staticTimeline;
  const { data, error } = await sb.from('timeline').select('*').order('date', { ascending: true });
  if (error || !data || data.length === 0) return staticTimeline;
  return (data as DbTimelineRow[]).map(fromTimelineRow);
}

export const contentRevalidate = REVALIDATE_SECONDS;
