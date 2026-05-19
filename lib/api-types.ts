export type Json = string | number | boolean | null | { [k: string]: Json } | Json[];

export type LocalizedJson = { zh: string; en: string };

export type SocialJson =
  | { type: 'github'; href: string; label?: string }
  | { type: 'wechat'; href: string; label?: string }
  | { type: 'linkedin'; href: string; label?: string }
  | { type: 'twitter'; href: string; label?: string };

export type DbProfileRow = {
  id: string;
  name_zh: string;
  name_en: string;
  handle: string;
  role_zh: string;
  role_en: string;
  slogan_zh: string;
  slogan_en: string;
  bio_zh: string;
  bio_en: string;
  avatar_url: string | null;
  socials: SocialJson[];
  updated_at: string;
};

export type DbProjectRow = {
  id: string;
  slug: string;
  kind: 'academic' | 'engineering';
  title_zh: string;
  title_en: string;
  tagline_zh: string;
  tagline_en: string;
  summary_zh: string;
  summary_en: string;
  tags: string[];
  highlights: LocalizedJson[];
  link: string | null;
  repo: string | null;
  cover_url: string | null;
  started_at: string;
  ended_at: string | null;
  display_order: number;
  is_published: boolean;
  created_at?: string;
  updated_at?: string;
};

export type DbExperienceRow = {
  id: string;
  slug: string;
  org_zh: string;
  org_en: string;
  role_zh: string;
  role_en: string;
  summary_zh: string;
  summary_en: string;
  metrics: LocalizedJson[];
  link: string | null;
  started_at: string;
  ended_at: string | null;
  display_order: number;
  is_published: boolean;
  created_at?: string;
  updated_at?: string;
};

export type DbHonorRow = {
  id: string;
  pillar: 'morality' | 'wisdom' | 'athletics' | 'labor';
  title_zh: string;
  title_en: string;
  story_zh: string;
  story_en: string;
  display_order: number;
  is_published: boolean;
};

export type DbEducationRow = {
  id: string;
  school_zh: string;
  school_en: string;
  degree_zh: string;
  degree_en: string;
  notes_zh: string | null;
  notes_en: string | null;
  started_at: string;
  ended_at: string | null;
  display_order: number;
};

export type DbTimelineRow = {
  id: string;
  date: string;
  kind: 'edu' | 'work' | 'project' | 'honor';
  title_zh: string;
  title_en: string;
  body_zh: string;
  body_en: string;
};

export type AdminSession = {
  authenticated: boolean;
  user?: {
    email: string;
    role: string;
  };
};

export type AdminSessionListItem = {
  id: string;
  ip?: string;
  userAgent?: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  current: boolean;
};

export type MediaUploadTicket = {
  uploadUrl: string;
  publicUrl: string;
};
