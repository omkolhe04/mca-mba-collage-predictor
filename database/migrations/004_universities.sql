-- ==========================================================
-- 004_universities.sql
--
-- Maharashtra affiliating universities (e.g. University of
-- Mumbai, SPPU, SRTMUN, etc.). Referenced by colleges
-- (affiliating university) and by users/predictions
-- (home university / admission university selected in the
-- prediction form).
-- ==========================================================

create table universities (
  id            uuid primary key default gen_random_uuid(),
  name          varchar(200) not null unique,
  short_name    varchar(50),
  region        varchar(100),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger trg_universities_updated_at
  before update on universities
  for each row execute function set_updated_at();

create index idx_universities_is_active on universities (is_active);
