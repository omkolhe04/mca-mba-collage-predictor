-- ==========================================================
-- 018_widen_cutoffs_text_columns.sql
--
-- Real official CAP cutoff data hit the varchar(50) limit on
-- status/section/stage during import ("value too long for type
-- character varying(50)"). These are purely descriptive fields
-- (not used in any matching/business logic — the Prediction
-- Engine and college-detail cutoff table never filter or compare
-- on them), so there's no reason to cap their length at all.
-- Switching to `text` (unbounded) removes this class of import
-- failure permanently, the same way address/website_url were
-- already modeled as `text` rather than a capped varchar.
-- ==========================================================

alter table cutoffs alter column status type text;
alter table cutoffs alter column section type text;
alter table cutoffs alter column stage type text;
