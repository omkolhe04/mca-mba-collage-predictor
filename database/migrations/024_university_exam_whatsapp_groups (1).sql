-- ==========================================================
-- 024_university_exam_whatsapp_groups.sql
--
-- Replaces the single whatsapp_group_link column added on
-- universities in migration 023 — that only supported one link
-- per university, but a university can have SEPARATE WhatsApp
-- groups for different entrance exams (e.g. its own MCA CET
-- admission group and a different MBA CET admission group).
--
-- No real data exists in the old column yet (confirmed — every
-- row still showed "Not set" in the admin panel at the time of
-- this change), so this drops it outright rather than migrating
-- data that was never actually populated.
-- ==========================================================

create table university_exam_whatsapp_groups (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references universities(id) on delete cascade,
  exam_type_id uuid not null references exam_types(id) on delete cascade,
  whatsapp_group_link text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (university_id, exam_type_id)
);

create trigger trg_university_exam_whatsapp_groups_updated_at
  before update on university_exam_whatsapp_groups
  for each row execute function set_updated_at();

alter table universities drop column if exists whatsapp_group_link;
