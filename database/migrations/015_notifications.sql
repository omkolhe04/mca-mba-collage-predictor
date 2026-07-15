-- ==========================================================
-- 015_notifications.sql
--
-- Site-wide notifications/announcements managed from the Admin
-- Panel (e.g. "CAP Round 2 registration open", "Site maintenance
-- on Sunday"). Optional scheduling window via starts_at/ends_at.
-- ==========================================================

create table notifications (
  id            uuid primary key default gen_random_uuid(),
  title         varchar(200) not null,
  message       text not null,
  type          varchar(20) not null default 'info',  -- 'info' | 'success' | 'warning' | 'urgent'

  starts_at     timestamptz,
  ends_at       timestamptz,
  is_active     boolean not null default true,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger trg_notifications_updated_at
  before update on notifications
  for each row execute function set_updated_at();

create index idx_notifications_active_window on notifications (is_active, starts_at, ends_at);
