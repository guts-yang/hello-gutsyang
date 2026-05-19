create extension if not exists pgcrypto;

create table if not exists admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  role text not null default 'admin',
  created_at timestamptz not null default now()
);

create table if not exists admin_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references admin_users(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists profile (
  id text primary key default 'main',
  name_zh text not null,
  name_en text not null,
  handle text not null,
  role_zh text not null,
  role_en text not null,
  slogan_zh text not null,
  slogan_en text not null,
  bio_zh text not null,
  bio_en text not null,
  avatar_url text,
  socials jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  kind text not null check (kind in ('academic', 'engineering')),
  title_zh text not null,
  title_en text not null,
  tagline_zh text not null,
  tagline_en text not null,
  summary_zh text not null,
  summary_en text not null,
  tags text[] not null default '{}',
  highlights jsonb not null default '[]'::jsonb,
  link text,
  repo text,
  cover_url text,
  started_at date not null,
  ended_at date,
  display_order int not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_published_order_idx
  on projects (is_published, display_order desc, started_at desc);

create table if not exists experiences (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  org_zh text not null,
  org_en text not null,
  role_zh text not null,
  role_en text not null,
  summary_zh text not null,
  summary_en text not null,
  metrics jsonb not null default '[]'::jsonb,
  link text,
  started_at date not null,
  ended_at date,
  display_order int not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists experiences_published_order_idx
  on experiences (is_published, display_order desc, started_at desc);

create table if not exists honors (
  id uuid primary key default gen_random_uuid(),
  pillar text not null check (pillar in ('morality', 'wisdom', 'athletics', 'labor')),
  title_zh text not null,
  title_en text not null,
  story_zh text not null,
  story_en text not null,
  display_order int not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists education (
  id uuid primary key default gen_random_uuid(),
  school_zh text not null,
  school_en text not null,
  degree_zh text not null,
  degree_en text not null,
  notes_zh text,
  notes_en text,
  started_at date not null,
  ended_at date,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists timeline (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  kind text not null check (kind in ('edu', 'work', 'project', 'honor')),
  title_zh text not null,
  title_en text not null,
  body_zh text not null,
  body_en text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
