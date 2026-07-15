-- ==========================================================
-- 019_cutoffs_seat_pool_and_gender.sql
--
-- Real official CAP cutoff data encodes THREE dimensions into
-- one compound category code (e.g. "GOPENH" = General seat +
-- OPEN category + Home University), plus a `section` field
-- describing the actual seat-pool allocation in plain English
-- (e.g. "Home University Seats Allotted to Home University
-- Candidates"). The original Phase 1 schema only modeled the
-- base category (category_id) — this adds the other two
-- dimensions, both nullable so existing rows and simple test
-- data (which use plain codes like "OPEN"/"TFWS") are unaffected.
--
-- raw_category_code : the original, undecoded string from the
--   source file — kept for audit/debugging so nothing is lost
--   even if the decoder logic needs future correction.
-- seat_pool : normalized seat-pool classification derived from
--   the `section` text (HOME_TO_HOME, HOME_TO_OTHER,
--   OTHER_TO_OTHER, STATE_LEVEL, MINORITY, UNKNOWN) — this is
--   what the Prediction Engine uses to check whether a student
--   is actually eligible for a given cutoff row, based on
--   whether their home university matches the college's.
-- seat_gender_type : 'G' (general/all genders) or 'L' (Ladies
--   seat), parsed from the category code's prefix.
-- ==========================================================

alter table cutoffs add column raw_category_code text;
alter table cutoffs add column seat_pool varchar(20);
alter table cutoffs add column seat_gender_type varchar(1);

create index idx_cutoffs_seat_pool on cutoffs (seat_pool);
