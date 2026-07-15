# Database — Phase 1

Normalized PostgreSQL schema for Supabase. UUID primary keys throughout,
proper foreign keys, and indexes chosen around the two heaviest real query
patterns: the Prediction Engine's cutoff lookup, and the college search page.

## How to apply this schema

**Option A — Supabase SQL Editor (simplest, no local setup):**
Open each file in `migrations/` in numeric order and run it in
Dashboard → SQL Editor. Then do the same for `seeds/`.

**Option B — scripted, from your machine:**
```bash
npm install   # installs pg, used only by these scripts
export DATABASE_URL="postgres://postgres:[password]@[host]:5432/postgres"
npm run migrate
npm run seed
```
Get `DATABASE_URL` from Supabase Dashboard → Project Settings → Database →
Connection string. This variable is **only** used by these one-off scripts —
the running app talks to Supabase exclusively through `supabase-js`
(`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`), never a direct DB connection.

## Entity overview

**Lookup tables** (small, admin-manageable, referenced everywhere else):
- `exam_types` — MCA_CET active today; MBA_CET / ENGG_CET seeded inactive for future reuse
- `universities` — Maharashtra affiliating universities
- `categories` — CAP admission categories (OPEN, OBC, SC, ST, TFWS, EWS, ...)

**Core domain:**
- `colleges` — one row per institute, scoped to an `exam_type`
- `college_branches` — course/branch offered at a college (one row for MCA today; this is what lets Engineering's 10-20 branches-per-college reuse the same schema later)
- `cutoffs` — the prediction dataset. Mirrors the official CAP JSON fields 1:1 (year, round, status, section, stage, category, cutoff_rank, percentile) so Phase 8's import engine needs no field transformation, just lookups + validation
- `placements`, `fees` — yearly, per-college, kept separate from `colleges` so historical data is never overwritten

**Users & predictions:**
- `users` — no login; created/updated automatically on form submit, keyed by `mobile` (unique)
- `predictions` — one row per prediction run; stores inputs + a `result_snapshot` JSONB so re-viewing a result or regenerating a PDF never needs to recompute against (possibly since-changed) cutoff data

**Admin-facing:**
- `admins` — the only table with real password-based auth (bcrypt hash + JWT), for the Admin Panel only
- `sliders`, `notifications` — homepage banner and site announcements, both admin-managed

## Key design decisions

- **Duplicate prevention on cutoffs**: `unique(college_id, branch_id, year, round, category_id, section, stage)` — the import engine (Phase 8) can safely re-run against the same year's data without creating duplicates.
- **Partial unique indexes on `fees`**: a plain `unique(..., category_id)` would NOT catch duplicate "standard fee" rows, since Postgres treats `NULL` as distinct in unique constraints. Two partial indexes close that gap explicitly — see comments in `011_fees.sql`.
- **RLS enabled, zero policies**: the app only ever uses the `service_role` key server-side (which bypasses RLS), so this doesn't affect app behavior. It's defense-in-depth — if the public/anon key is ever accidentally exposed client-side, every table defaults to fully locked down rather than fully open.
- **`updated_at` via trigger, not app code**: one shared `set_updated_at()` function attached to every table, so timestamp correctness never depends on a service remembering to set it.

## Not yet decided / confirm before Phase 8

The `status`, `section`, and `stage` columns on `cutoffs` are stored as plain
text, matching the field names given in the spec, but their real-world value
sets haven't been confirmed against actual official CAP JSON yet. Before
building the import engine in Phase 8, we should look at one real sample
JSON file together to confirm these are being interpreted correctly.
