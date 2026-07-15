-- ==========================================================
-- 012_predictions.sql
--
-- One row per prediction form submission. Stores the inputs
-- (for the record and for re-running the engine if cutoff data
-- is later corrected) plus a JSONB snapshot of the computed
-- result. The snapshot means:
--   - Re-opening a past result or re-downloading a PDF never
--     needs to recompute the prediction engine.
--   - Admin analytics can query result_snapshot directly
--     without joining across colleges/cutoffs as they existed
--     at prediction time (which may since have changed).
-- ==========================================================

create table predictions (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references users(id) on delete cascade,
  exam_type_id              uuid not null references exam_types(id),

  percentile                numeric(10, 7) not null,
  category_id               uuid not null references categories(id),
  gender                    varchar(20) not null,

  home_university_id        uuid references universities(id),
  admission_university_id   uuid references universities(id),
  dream_college_id          uuid references colleges(id),

  is_tfws                   boolean not null default false,
  is_ews                    boolean not null default false,
  is_minority                boolean not null default false,
  is_defence                boolean not null default false,
  is_pwd                    boolean not null default false,

  -- Full computed result: dream college chance, chance buckets,
  -- recommended CAP preference order. Shape defined and
  -- documented in the Prediction Engine service (Phase 4).
  result_snapshot           jsonb not null default '{}'::jsonb,

  pdf_generated_at          timestamptz,
  pdf_storage_path          text,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create trigger trg_predictions_updated_at
  before update on predictions
  for each row execute function set_updated_at();

create index idx_predictions_user on predictions (user_id);
create index idx_predictions_exam_type on predictions (exam_type_id);
create index idx_predictions_created_at on predictions (created_at);
-- Supports admin dashboard analytics filtered by category/university.
create index idx_predictions_category on predictions (category_id);
