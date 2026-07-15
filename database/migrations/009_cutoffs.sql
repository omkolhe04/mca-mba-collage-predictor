-- ==========================================================
-- 009_cutoffs.sql
--
-- The core prediction dataset. One row per
-- (college, branch, year, round, category, section, stage)
-- combination, mirroring the official CAP cutoff JSON fields
-- 1:1 (Year, Round, College Code, College Name, Branch Code,
-- Branch, Status, Section, Stage, Category, Cutoff Rank,
-- Percentile) so the import engine (Phase 8) can map JSON
-- fields to columns with no transformation logic beyond
-- lookups. This is the table the Prediction Engine (Phase 4)
-- queries most heavily.
--
-- "status", "section", and "stage" are kept as plain text
-- columns rather than guessed-at lookup tables, since their
-- exact value sets are defined by the official CAP data
-- release and should be confirmed against real sample JSON
-- before being over-normalized.
-- ==========================================================

create table cutoffs (
  id                uuid primary key default gen_random_uuid(),
  college_id        uuid not null references colleges(id) on delete cascade,
  branch_id         uuid not null references college_branches(id) on delete cascade,
  category_id       uuid not null references categories(id),

  year              smallint not null,
  round             varchar(20) not null,     -- e.g. 'CAP1', 'CAP2', 'CAP3', 'CAP4'
  status            varchar(50),              -- as published in source JSON (e.g. seat status)
  section           varchar(50),              -- as published in source JSON
  stage             varchar(50),              -- as published in source JSON

  cutoff_rank       integer,
  cutoff_percentile numeric(10, 7),

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- Prevents duplicate rows on re-import, per the "prevents
  -- duplicates" requirement in the import engine spec.
  unique (college_id, branch_id, year, round, category_id, section, stage)
);

create trigger trg_cutoffs_updated_at
  before update on cutoffs
  for each row execute function set_updated_at();

-- Primary lookup pattern for the Prediction Engine: given a
-- category and the most recent year/round, find every cutoff
-- at or below a candidate's percentile.
create index idx_cutoffs_prediction_lookup
  on cutoffs (category_id, year, round, cutoff_percentile);

create index idx_cutoffs_college_branch on cutoffs (college_id, branch_id);
create index idx_cutoffs_year_round on cutoffs (year, round);
