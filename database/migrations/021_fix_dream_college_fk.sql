-- ==========================================================
-- 021_fix_dream_college_fk.sql
--
-- predictions.dream_college_id originally had no explicit
-- ON DELETE behavior, which defaults to Postgres blocking
-- deletion of any college that was ever selected as someone's
-- dream college. That's the wrong behavior for this column —
-- it's an informational reference (the actual dream-college name
-- is already denormalized into predictions.result_snapshot at
-- prediction time), not something that should prevent an admin
-- from resetting/re-importing college data. Changing it to
-- ON DELETE SET NULL: deleting a college simply clears the
-- dream_college_id reference on any prediction that pointed to
-- it, without touching the prediction itself or its already-
-- computed result_snapshot (which still displays correctly,
-- since it stored the dream college's name/id/chance data at
-- the time, independent of whether the live row still exists).
-- ==========================================================

-- Looks up the actual constraint name rather than hardcoding it
-- (it should be predictions_dream_college_id_fkey per Postgres's
-- standard auto-naming convention, but this is safer than
-- assuming that against a database we can't test against here).
do $$
declare
  constraint_name text;
begin
  select tc.constraint_name into constraint_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name
  where tc.table_name = 'predictions'
    and tc.constraint_type = 'FOREIGN KEY'
    and kcu.column_name = 'dream_college_id';

  if constraint_name is not null then
    execute format('alter table predictions drop constraint %I', constraint_name);
  end if;

  alter table predictions
    add constraint predictions_dream_college_id_fkey
    foreign key (dream_college_id) references colleges(id) on delete set null;
end $$;
