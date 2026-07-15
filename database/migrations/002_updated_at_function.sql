-- ==========================================================
-- 002_updated_at_function.sql
-- Generic trigger function that stamps updated_at on every row
-- update. Attached to each table individually further down so
-- we never rely on application code to remember to set it.
-- ==========================================================

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;
