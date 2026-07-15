-- ==========================================================
-- 013_admins.sql
--
-- Admin Panel users. This is the one place real login exists
-- in the whole product (public site has none, by design).
-- Passwords hashed with bcrypt in the auth service, never
-- stored or handled in plain text.
-- ==========================================================

create table admins (
  id              uuid primary key default gen_random_uuid(),
  name            varchar(150) not null,
  email           varchar(255) not null unique,
  password_hash   text not null,
  role            varchar(30) not null default 'admin',  -- 'super_admin' | 'admin'
  is_active       boolean not null default true,
  last_login_at   timestamptz,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger trg_admins_updated_at
  before update on admins
  for each row execute function set_updated_at();

create index idx_admins_is_active on admins (is_active);
