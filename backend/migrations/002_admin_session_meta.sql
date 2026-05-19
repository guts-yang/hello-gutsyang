-- Add per-session bookkeeping fields used by the settings page in Phase 2:
--   ip            – the address that minted the session (last hop after XFF)
--   user_agent    – first 256 chars of the browser UA string
--   last_seen_at  – touched on every authenticated request (sliding renewal)
--
-- All three are nullable so existing rows keep working without backfill.

alter table admin_sessions
  add column if not exists ip text,
  add column if not exists user_agent text,
  add column if not exists last_seen_at timestamptz;

create index if not exists admin_sessions_user_id_last_seen_idx
  on admin_sessions (user_id, last_seen_at desc nulls last);
