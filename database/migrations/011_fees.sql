-- ==========================================================
-- 011_fees.sql
--
-- Fee structure per college per academic year. category_id is
-- nullable: null means "standard fee applicable to all
-- categories"; a specific category_id is used for cases like
-- TFWS (fee waiver) or category-specific fee differences.
-- ==========================================================

create table fees (
  id                uuid primary key default gen_random_uuid(),
  college_id        uuid not null references colleges(id) on delete cascade,
  category_id       uuid references categories(id),

  academic_year     varchar(9) not null,     -- e.g. '2025-26'
  annual_fee        numeric(10, 2) not null,
  total_course_fee  numeric(10, 2),          -- full 2-year MCA program, if published

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger trg_fees_updated_at
  before update on fees
  for each row execute function set_updated_at();

create index idx_fees_college on fees (college_id);
create index idx_fees_academic_year on fees (academic_year);

-- Postgres treats NULL as distinct in a plain UNIQUE constraint,
-- so a normal unique(college_id, academic_year, category_id)
-- would silently allow multiple "standard fee" (category_id
-- IS NULL) rows for the same college/year. Two partial unique
-- indexes close that gap explicitly.
create unique index uq_fees_with_category
  on fees (college_id, academic_year, category_id)
  where category_id is not null;

create unique index uq_fees_without_category
  on fees (college_id, academic_year)
  where category_id is null;
