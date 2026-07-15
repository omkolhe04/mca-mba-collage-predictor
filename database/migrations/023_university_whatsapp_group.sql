-- ==========================================================
-- 023_university_whatsapp_group.sql
--
-- Adds a per-university WhatsApp group invite link, managed by
-- admins (Admin -> WhatsApp Groups) and shown on the result page
-- as a "Join {short_name} Admission Support Group" button, scoped
-- to whichever Admission University the student selected. Left
-- blank (null) for any university that doesn't have a group set
-- up yet — the result page falls back gracefully when this is
-- empty, rather than showing a broken/empty button.
-- ==========================================================

alter table universities add column whatsapp_group_link text;
