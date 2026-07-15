-- ==========================================================
-- 003_exam_types.sql
--
-- Lookup table that lets this exact schema and codebase be
-- reused for MBA CET / Engineering CET predictors later, as
-- required by the "Future Scalability" spec. Every table that
-- is exam-specific (colleges, branches, cutoffs, predictions)
-- carries an exam_type_id foreign key. For this phase, only
-- MCA_CET is seeded and used.
-- ==========================================================

create table exam_types (
  id            uuid primary key default gen_random_uuid(),
  code          varchar(30) not null unique,   -- e.g. 'MCA_CET', 'MBA_CET', 'ENGG_CET'
  name          varchar(150) not null,         -- e.g. 'MCA CET'
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger trg_exam_types_updated_at
  before update on exam_types
  for each row execute function set_updated_at();

create index idx_exam_types_is_active on exam_types (is_active);
