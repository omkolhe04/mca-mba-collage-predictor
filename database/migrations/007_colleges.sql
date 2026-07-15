-- ==========================================================
-- 007_colleges.sql
--
-- Master college/institute records. One row per DTE Maharashtra
-- institute code. Branch-level detail (relevant once this
-- architecture is reused for Engineering, which has many
-- branches per college) lives in college_branches.
-- ==========================================================

create table colleges (
  id                  uuid primary key default gen_random_uuid(),
  exam_type_id        uuid not null references exam_types(id),
  university_id       uuid references universities(id),

  college_code        varchar(20) not null,   -- official DTE institute code
  name                varchar(300) not null,
  address             text,
  city                varchar(120),
  district            varchar(120),
  pincode             varchar(10),

  website_url         text,
  google_maps_url     text,

  naac_grade          varchar(10),            -- e.g. 'A++', 'A+', 'B', null if not accredited
  nba_accredited      boolean not null default false,
  aicte_approved      boolean not null default false,
  autonomous          boolean not null default false,
  hostel_available    boolean not null default false,

  established_year    smallint,
  intake_capacity     integer,                -- total MCA intake, informational

  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  unique (exam_type_id, college_code)
);

create trigger trg_colleges_updated_at
  before update on colleges
  for each row execute function set_updated_at();

create index idx_colleges_exam_type on colleges (exam_type_id);
create index idx_colleges_university on colleges (university_id);
create index idx_colleges_city on colleges (city);
create index idx_colleges_is_active on colleges (is_active);
-- Supports "search college by name" on the details/browse pages.
create index idx_colleges_name_trgm on colleges using gin (name gin_trgm_ops);
