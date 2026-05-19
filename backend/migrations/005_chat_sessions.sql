-- Visitor-owned chat sessions for the public AI concierge. Each visitor is
-- identified by an anonymous owner cookie (a UUID handed out by the server on
-- first contact); a single owner can hold multiple sessions and every session
-- preserves its message transcript. There is no admin coupling here -- this
-- store is intentionally independent of admin_users / admin_audit.

create table if not exists chat_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  title text not null,
  locale text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chat_sessions_owner_updated_idx
  on chat_sessions (owner_id, updated_at desc);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references chat_sessions(id) on delete cascade,
  role text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_session_created_idx
  on chat_messages (session_id, created_at);
