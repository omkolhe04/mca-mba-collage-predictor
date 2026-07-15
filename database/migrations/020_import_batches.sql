-- ==========================================================
-- 020_import_batches.sql
--
-- Tracks each cutoff-data import as its own record (filename,
-- when, by whom, and the resulting stats), and tags every
-- cutoff row with which import batch last wrote it. This
-- enables an import history view in the Admin Panel, and lets
-- an admin delete all cutoff data that came from one specific
-- import without touching data from other imports.
--
-- Deleting an import batch only removes cutoff rows (percentile/
-- rank data) — colleges and branches are NOT deleted, since they
-- are frequently shared across multiple round files and may
-- carry admin-entered profile data (address, NAAC, fees) that a
-- cutoff-data deletion should never destroy.
--
-- ON DELETE SET NULL (not CASCADE): cutoff-row deletion for a
-- batch is handled explicitly in application code (so the count
-- of deleted rows can be reported back to the admin), not via an
-- automatic cascade — this is a safety net for the FK, not the
-- primary deletion mechanism.
-- ==========================================================

create table import_batches (
  id                        uuid primary key default gen_random_uuid(),
  exam_type_id              uuid not null references exam_types(id),
  filename                  text not null,
  imported_by               uuid references admins(id),

  total_rows                integer not null default 0,
  valid_row_count           integer not null default 0,
  invalid_row_count         integer not null default 0,
  colleges_upserted         integer not null default 0,
  branches_upserted         integer not null default 0,
  cutoffs_upserted          integer not null default 0,
  duplicate_rows_collapsed  integer not null default 0,

  created_at                timestamptz not null default now()
);

create index idx_import_batches_exam_type on import_batches (exam_type_id);
create index idx_import_batches_created_at on import_batches (created_at);

alter table cutoffs add column import_batch_id uuid references import_batches(id) on delete set null;
create index idx_cutoffs_import_batch on cutoffs (import_batch_id);
