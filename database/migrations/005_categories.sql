-- ==========================================================
-- 005_categories.sql
--
-- CAP admission categories (OPEN, OBC, SC, ST, VJ, NT1, NT2,
-- NT3, SBC, EWS, TFWS, PWD, DEFENCE, MI, ORPHAN, etc).
-- A lookup table instead of free text / enum so:
--   - the import engine can validate incoming category codes
--     against a known list instead of silently accepting typos
--   - the admin panel can manage/display categories consistently
--   - new categories added by the state in future years don't
--     require a schema change, just a new row
-- ==========================================================

create table categories (
  id            uuid primary key default gen_random_uuid(),
  code          varchar(20) not null unique,   -- e.g. 'OPEN', 'OBC', 'TFWS', 'EWS'
  name          varchar(150) not null,         -- display name
  is_special    boolean not null default false, -- true for TFWS/EWS/PWD/Defence/Minority-style special reservations
  display_order integer not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger trg_categories_updated_at
  before update on categories
  for each row execute function set_updated_at();

create index idx_categories_is_active on categories (is_active);
