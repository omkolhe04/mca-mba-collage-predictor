-- ==========================================================
-- 022_exam_cap_rounds_config.sql
--
-- Phase 11a — Multi-Exam Platform Foundation.
--
-- CAP round count was hardcoded to 4 everywhere (the engine,
-- result page, college detail page, PDF report) because only
-- MCA CET existed. Now that MBA CET is being enabled (3 rounds,
-- not 4), this must become per-exam configuration instead — the
-- exact requirement from the multi-exam refactor spec: "Do NOT
-- hardcode CAP rounds. Instead store number of CAP rounds inside
-- Exam Configuration."
--
-- MCA_CET keeps its existing 4 rounds (no visible change to
-- existing functionality). MBA_CET is set to 3 rounds and
-- activated. ENGG_CET gets a placeholder round count and stays
-- inactive until it's actually built out.
-- ==========================================================

alter table exam_types add column cap_rounds smallint not null default 4;

update exam_types set cap_rounds = 4 where code = 'MCA_CET';
update exam_types set cap_rounds = 3, is_active = true where code = 'MBA_CET';
update exam_types set cap_rounds = 4 where code = 'ENGG_CET';
