-- Phase 3 schema for the personal site CMS.
-- Apply with: supabase db push  (or paste into the SQL editor)

create extension if not exists "pgcrypto";

------------------------------------------------------------
-- profile (singleton row, id = 'main')
------------------------------------------------------------
create table if not exists public.profile (
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

------------------------------------------------------------
-- projects
------------------------------------------------------------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
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
  on public.projects (is_published, display_order desc, started_at desc);

------------------------------------------------------------
-- experiences
------------------------------------------------------------
create table if not exists public.experiences (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
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
  on public.experiences (is_published, display_order desc, started_at desc);

------------------------------------------------------------
-- honors (4 pillars: morality / wisdom / athletics / labor)
------------------------------------------------------------
create table if not exists public.honors (
  id uuid primary key default gen_random_uuid(),
  pillar text not null check (pillar in ('morality', 'wisdom', 'athletics', 'labor')),
  title_zh text not null,
  title_en text not null,
  story_zh text not null,
  story_en text not null,
  display_order int not null default 0,
  is_published boolean not null default true
);

------------------------------------------------------------
-- education
------------------------------------------------------------
create table if not exists public.education (
  id uuid primary key default gen_random_uuid(),
  school_zh text not null,
  school_en text not null,
  degree_zh text not null,
  degree_en text not null,
  notes_zh text,
  notes_en text,
  started_at date not null,
  ended_at date,
  display_order int not null default 0
);

------------------------------------------------------------
-- timeline
------------------------------------------------------------
create table if not exists public.timeline (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  kind text not null check (kind in ('edu', 'work', 'project', 'honor')),
  title_zh text not null,
  title_en text not null,
  body_zh text not null,
  body_en text not null
);

------------------------------------------------------------
-- updated_at trigger
------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_projects_touch on public.projects;
create trigger trg_projects_touch
  before update on public.projects
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_experiences_touch on public.experiences;
create trigger trg_experiences_touch
  before update on public.experiences
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_profile_touch on public.profile;
create trigger trg_profile_touch
  before update on public.profile
  for each row execute function public.touch_updated_at();

------------------------------------------------------------
-- Row Level Security: anonymous can read published rows; auth users full access.
------------------------------------------------------------
alter table public.profile     enable row level security;
alter table public.projects    enable row level security;
alter table public.experiences enable row level security;
alter table public.honors      enable row level security;
alter table public.education   enable row level security;
alter table public.timeline    enable row level security;

-- Public reads
drop policy if exists profile_read on public.profile;
create policy profile_read on public.profile for select using (true);

drop policy if exists projects_read on public.projects;
create policy projects_read on public.projects for select using (is_published);

drop policy if exists experiences_read on public.experiences;
create policy experiences_read on public.experiences for select using (is_published);

drop policy if exists honors_read on public.honors;
create policy honors_read on public.honors for select using (is_published);

drop policy if exists education_read on public.education;
create policy education_read on public.education for select using (true);

drop policy if exists timeline_read on public.timeline;
create policy timeline_read on public.timeline for select using (true);

-- Authenticated owner write (single user; in production combine with email allowlist).
drop policy if exists profile_write on public.profile;
create policy profile_write on public.profile for all to authenticated using (true) with check (true);

drop policy if exists projects_write on public.projects;
create policy projects_write on public.projects for all to authenticated using (true) with check (true);

drop policy if exists experiences_write on public.experiences;
create policy experiences_write on public.experiences for all to authenticated using (true) with check (true);

drop policy if exists honors_write on public.honors;
create policy honors_write on public.honors for all to authenticated using (true) with check (true);

drop policy if exists education_write on public.education;
create policy education_write on public.education for all to authenticated using (true) with check (true);

drop policy if exists timeline_write on public.timeline;
create policy timeline_write on public.timeline for all to authenticated using (true) with check (true);

------------------------------------------------------------
-- Storage bucket for project covers / avatar / WeChat QR.
-- Public reads, authenticated writes.
------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = excluded.public;

alter table storage.objects enable row level security;

drop policy if exists media_public_read on storage.objects;
create policy media_public_read
  on storage.objects for select
  using (bucket_id = 'media');

drop policy if exists media_authenticated_insert on storage.objects;
create policy media_authenticated_insert
  on storage.objects for insert to authenticated
  with check (bucket_id = 'media');

drop policy if exists media_authenticated_update on storage.objects;
create policy media_authenticated_update
  on storage.objects for update to authenticated
  using (bucket_id = 'media')
  with check (bucket_id = 'media');

drop policy if exists media_authenticated_delete on storage.objects;
create policy media_authenticated_delete
  on storage.objects for delete to authenticated
  using (bucket_id = 'media');
