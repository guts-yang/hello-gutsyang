-- Slow-path brute force defense. The token-bucket limiter on /v1/admin/login
-- already drops bursts per IP; this table is the long-tail counter that
-- captures distributed retries (one bad password per IP, but many IPs).
--
-- Each attempt — successful or not — is appended here. The login handler
-- counts recent failures within a configurable window and returns 429 once a
-- threshold is hit, regardless of whether the offender is still under the
-- token-bucket limit.

create table if not exists admin_login_attempts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  ip text not null,
  succeeded boolean not null,
  attempted_at timestamptz not null default now()
);

create index if not exists admin_login_attempts_email_attempted_idx
  on admin_login_attempts (lower(email), attempted_at desc)
  where succeeded = false;

create index if not exists admin_login_attempts_ip_attempted_idx
  on admin_login_attempts (ip, attempted_at desc)
  where succeeded = false;
