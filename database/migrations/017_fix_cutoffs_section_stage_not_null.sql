-- ==========================================================
-- 017_fix_cutoffs_section_stage_not_null.sql
--
-- BUG FIX: the unique constraint on cutoffs (college_id,
-- branch_id, year, round, category_id, section, stage) does
-- not actually prevent duplicates when section/stage are NULL,
-- because Postgres treats NULL as distinct from NULL in unique
-- constraints — two rows that are identical except both having
-- NULL section/stage would NOT be flagged as duplicates, and an
-- upsert's ON CONFLICT clause would not match them either,
-- silently inserting a new row on every re-import instead of
-- updating the existing one.
--
-- This is the same class of bug already fixed on the `fees`
-- table in migration 011, caught late here while building the
-- Phase 8 import engine that depends on this constraint working
-- correctly. Fix: make section/stage NOT NULL with a default
-- empty string, so two "no section/stage" rows are correctly
-- treated as identical (both '') rather than both-distinct-NULL.
-- ==========================================================

update cutoffs set section = '' where section is null;
update cutoffs set stage = '' where stage is null;

alter table cutoffs alter column section set default '';
alter table cutoffs alter column stage set default '';

alter table cutoffs alter column section set not null;
alter table cutoffs alter column stage set not null;
