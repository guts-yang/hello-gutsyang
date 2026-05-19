-- Append-only audit log for admin actions. The /v1/admin/audit endpoint reads
-- back the latest pages so an operator can see "who did what when" without
-- digging through application logs.
--
-- user_id is nullable because we keep audit rows even after the admin user
-- gets deleted (on delete set null). Action is a short identifier such as
-- "login.success" / "login.failure" / "session.revoke" / "profile.update".

create table if not exists admin_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references admin_users(id) on delete set null,
  action text not null,
  target text,
  ip text,
  user_agent text,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_created_at_idx
  on admin_audit (created_at desc);

create index if not exists admin_audit_action_created_at_idx
  on admin_audit (action, created_at desc);
