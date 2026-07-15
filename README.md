# VidyaNITI — MCA CET College Predictor

Production website that predicts MCA CET CAP admission chances for Maharashtra
candidates, based on official CAP cutoff data.

## Tech Stack

- **Frontend:** EJS, Bootstrap 5, Vanilla JS
- **Backend:** Node.js, Express.js
- **Database:** Supabase PostgreSQL
- **Storage:** Supabase Storage
- **PDF:** PDFKit (chosen for standard shared cPanel hosting compatibility —
  no headless-browser binary required)
- **Hosting:** Shared cPanel hosting (Node.js App Manager / Passenger)

## Architecture

Clean, layered architecture — business logic never lives in routes:

```
Routes -> Controllers -> Services -> Repositories -> Supabase
```

- **Routes** — declare endpoints, apply middleware, delegate to controllers.
- **Controllers** — thin. Extract request data, call a service, respond.
- **Services** — all business logic (prediction engine, PDF generation, etc).
- **Repositories** — the only layer that talks to Supabase directly.

## Project Structure

```
src/
  config/         env loader, Supabase client
  routes/         Express routers per feature
  controllers/    thin request/response handlers
  services/       business logic
  repositories/   Supabase data access
  middlewares/    error handling, auth, etc.
  validators/     express-validator schemas
  utils/          logger, AppError, asyncHandler, session helper
views/
  layouts/        shared EJS layout
  partials/       header, footer, reusable includes
  pages/          public-facing pages
  admin/          admin panel pages
public/
  css/            design tokens + global styles
  js/             vanilla JS, loaded per-page
data/imports/     source JSON files for CAP cutoff import engine
database/
  migrations/     numbered SQL schema migrations (run in order)
  seeds/          lookup table starter data
  run-migrations.js, run-seeds.js
```

See `database/README.md` for the full schema documentation, entity
overview, and how to apply migrations to your Supabase project.

## Setup

```bash
npm install
cp .env.example .env   # then fill in real values
npm run dev             # nodemon, local development
npm start                # production
```

## Identity Model

There is no login/signup for end users. On prediction form submit, the user
is created or updated in the database using **mobile number** as the unique
key. A long-lived signed cookie then silently re-identifies a returning
visitor on the same browser — no visible authentication step.

The **Admin Panel** is the only part of the site with real authentication
(JWT-based).

## Build Phases

This project is being built phase by phase, with explicit approval required
after each phase before moving to the next. See project instructions for the
full phase list.

- [x] Phase 0 — Project Foundation
- [x] Phase 1 — Database Design
- [ ] Phase 2 — Landing Page
- [ ] Phase 3 — Prediction Form
- [ ] Phase 4 — Prediction Engine
- [ ] Phase 5 — Prediction Result Page
- [ ] Phase 6 — College Details Page
- [ ] Phase 7 — PDF Report Generation
- [ ] Phase 8 — Data Import Engine
- [ ] Phase 9 — Admin Panel
- [ ] Phase 10 — Notifications + Slider Management
