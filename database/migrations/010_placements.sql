-- ==========================================================
-- 010_placements.sql
--
-- Placement statistics per college per academic year. Kept
-- separate from colleges (rather than columns on colleges)
-- since it changes yearly and colleges don't, avoiding
-- destructive overwrites of historical placement data.
-- ==========================================================

create table placements (
  id                    uuid primary key default gen_random_uuid(),
  college_id            uuid not null references colleges(id) on delete cascade,

  academic_year         varchar(9) not null,   -- e.g. '2025-26'
  average_package_lpa   numeric(10, 2),
  highest_package_lpa   numeric(10, 2),
  students_placed       integer,
  total_eligible        integer,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  unique (college_id, academic_year)
);

create trigger trg_placements_updated_at
  before update on placements
  for each row execute function set_updated_at();

create index idx_placements_college on placements (college_id);
create index idx_placements_academic_year on placements (academic_year);
