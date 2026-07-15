-- ==========================================================
-- 008_college_branches.sql
--
-- Branch/course offered at a college. For MCA CET this is
-- effectively one row per college ("Master of Computer
-- Applications"), but modeling it as its own table (rather
-- than folding branch into colleges or cutoffs) is what makes
-- this schema reusable for Engineering, where one college has
-- 10-20+ branches, without any structural change later.
-- ==========================================================

create table college_branches (
  id                uuid primary key default gen_random_uuid(),
  college_id        uuid not null references colleges(id) on delete cascade,

  branch_code       varchar(20) not null,     -- official DTE branch code
  branch_name       varchar(200) not null,    -- e.g. 'Master of Computer Applications'
  intake_capacity   integer,

  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  unique (college_id, branch_code)
);

create trigger trg_college_branches_updated_at
  before update on college_branches
  for each row execute function set_updated_at();

create index idx_college_branches_college on college_branches (college_id);
create index idx_college_branches_is_active on college_branches (is_active);
