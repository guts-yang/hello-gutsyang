import 'server-only';
import { fetchBackendJson } from '@/lib/backend';
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
import type { SocialJson } from '@/lib/api-types';

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

type BackendLocalized = { zh: string; en: string };
type BackendProfile = {
  nameZh: string;
  nameEn: string;
  handle: string;
  role: BackendLocalized;
  slogan: BackendLocalized;
  bio: BackendLocalized;
  avatarUrl?: string;
  socials: SocialJson[];
};
type BackendProject = {
  slug: string;
  kind: 'academic' | 'engineering';
  title: BackendLocalized;
  tagline: BackendLocalized;
  summary: BackendLocalized;
  tags: string[];
  highlights: BackendLocalized[];
  link?: string;
  repo?: string;
  coverUrl?: string;
  startedAt: string;
  endedAt?: string;
};
type BackendExperience = {
  slug: string;
  org: BackendLocalized;
  role: BackendLocalized;
  summary: BackendLocalized;
  metrics: BackendLocalized[];
  startedAt: string;
  endedAt?: string;
  link?: string;
};
type BackendHonor = {
  pillar: 'morality' | 'wisdom' | 'athletics' | 'labor';
  title: BackendLocalized;
  story: BackendLocalized;
};
type BackendEducation = {
  school: BackendLocalized;
  degree: BackendLocalized;
  startedAt: string;
  endedAt?: string;
  notes?: BackendLocalized;
};
type BackendTimeline = {
  date: string;
  kind: 'edu' | 'work' | 'project' | 'honor';
  title: BackendLocalized;
  body: BackendLocalized;
};
type BackendHome = {
  profile: BackendProfile;
  projects: BackendProject[];
  experiences: BackendExperience[];
  honors: BackendHonor[];
  education: BackendEducation[];
  timeline: BackendTimeline[];
};

function fromBackendProject(project: BackendProject): Project {
  return {
    slug: project.slug,
    kind: project.kind,
    title: project.title,
    tagline: project.tagline,
    summary: project.summary,
    tags: project.tags ?? [],
    highlights: project.highlights ?? [],
    link: project.link,
    repo: project.repo,
    cover: project.coverUrl,
    startedAt: project.startedAt,
    endedAt: project.endedAt,
  };
}

function fromBackendExperience(experience: BackendExperience): Experience {
  return {
    slug: experience.slug,
    org: experience.org,
    role: experience.role,
    summary: experience.summary,
    metrics: experience.metrics ?? [],
    startedAt: experience.startedAt,
    endedAt: experience.endedAt,
    link: experience.link,
  };
}

function fromBackendHonor(honor: BackendHonor): Honor {
  return {
    pillar: honor.pillar,
    title: honor.title,
    story: honor.story,
  };
}

function fromBackendEducation(education: BackendEducation): Education {
  return {
    school: education.school,
    degree: education.degree,
    startedAt: education.startedAt,
    endedAt: education.endedAt,
    notes: education.notes,
  };
}

function fromBackendTimeline(event: BackendTimeline): TimelineEvent {
  return {
    date: event.date,
    kind: event.kind,
    title: event.title,
    body: event.body,
  };
}

function fromBackendProfile(profile: BackendProfile): ProfileBundle {
  return {
    nameZh: profile.nameZh,
    nameEn: profile.nameEn,
    handle: profile.handle,
    role: profile.role,
    slogan: profile.slogan,
    bio: profile.bio,
    avatarUrl: profile.avatarUrl,
    socials: profile.socials ?? [],
  };
}

async function getHomeSnapshot() {
  try {
    const payload = await fetchBackendJson<BackendHome>('/v1/public/home', {}, { revalidate: REVALIDATE_SECONDS });
    return {
      profile: fromBackendProfile(payload.profile),
      projects: payload.projects.map(fromBackendProject),
      experiences: payload.experiences.map(fromBackendExperience),
      honors: payload.honors.map(fromBackendHonor),
      education: payload.education.map(fromBackendEducation),
      timeline: payload.timeline.map(fromBackendTimeline),
    };
  } catch {
    return {
      profile: staticProfileBundle,
      projects: staticProjects,
      experiences: staticExperiences,
      honors: staticHonors,
      education: staticEducation,
      timeline: staticTimeline,
    };
  }
}

export async function getHomeContent() {
  return getHomeSnapshot();
}

export async function getProfile(): Promise<ProfileBundle> {
  const snapshot = await getHomeSnapshot();
  return snapshot.profile;
}

export async function getProjects(): Promise<Project[]> {
  const snapshot = await getHomeSnapshot();
  return snapshot.projects;
}

export async function getProjectBySlug(slug: string): Promise<Project | undefined> {
  const all = await getProjects();
  return all.find((p) => p.slug === slug);
}

export async function getExperiences(): Promise<Experience[]> {
  const snapshot = await getHomeSnapshot();
  return snapshot.experiences;
}

export async function getExperienceBySlug(slug: string): Promise<Experience | undefined> {
  const all = await getExperiences();
  return all.find((e) => e.slug === slug);
}

export async function getHonors(): Promise<Honor[]> {
  const snapshot = await getHomeSnapshot();
  return snapshot.honors;
}

export async function getEducation(): Promise<Education[]> {
  const snapshot = await getHomeSnapshot();
  return snapshot.education;
}

export async function getTimeline(): Promise<TimelineEvent[]> {
  const snapshot = await getHomeSnapshot();
  return snapshot.timeline;
}

export const contentRevalidate = REVALIDATE_SECONDS;
