-- Seed: exam_types
-- Only MCA_CET is active for this phase. MBA_CET / ENGG_CET
-- rows are pre-added but inactive, ready for future reuse.

insert into exam_types (code, name, is_active) values
  ('MCA_CET', 'MCA CET', true),
  ('MBA_CET', 'MBA CET', false),
  ('ENGG_CET', 'Engineering CET', false)
on conflict (code) do nothing;
