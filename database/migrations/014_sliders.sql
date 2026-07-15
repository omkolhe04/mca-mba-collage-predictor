-- ==========================================================
-- 014_sliders.sql
--
-- Homepage banner/slider images, managed from the Admin Panel.
-- Images themselves live in Supabase Storage; this table just
-- stores the reference path and display metadata.
-- ==========================================================

create table sliders (
  id              uuid primary key default gen_random_uuid(),
  title           varchar(200),
  image_path      text not null,        -- Supabase Storage object path
  link_url        text,
  display_order   integer not null default 0,
  is_active       boolean not null default true,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger trg_sliders_updated_at
  before update on sliders
  for each row execute function set_updated_at();

create index idx_sliders_active_order on sliders (is_active, display_order);
