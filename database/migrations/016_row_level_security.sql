-- ==========================================================
-- 016_row_level_security.sql
--
-- This application only ever talks to Supabase using the
-- service_role key from trusted server-side code (never the
-- anon key from a browser), so RLS is not functionally
-- required for the app to work. We enable it anyway, with no
-- permissive policies, as defense-in-depth: if the anon/public
-- key is ever accidentally exposed (client-side code, a leaked
-- key, etc.), every table defaults to fully locked down rather
-- than fully open. service_role bypasses RLS entirely, so none
-- of this affects normal app behavior.
-- ==========================================================

alter table exam_types        enable row level security;
alter table universities      enable row level security;
alter table categories        enable row level security;
alter table users             enable row level security;
alter table colleges          enable row level security;
alter table college_branches  enable row level security;
alter table cutoffs           enable row level security;
alter table placements        enable row level security;
alter table fees              enable row level security;
alter table predictions       enable row level security;
alter table admins            enable row level security;
alter table sliders           enable row level security;
alter table notifications     enable row level security;

-- No policies are created. Zero policies + RLS enabled means
-- zero access for anon/authenticated roles by default.
