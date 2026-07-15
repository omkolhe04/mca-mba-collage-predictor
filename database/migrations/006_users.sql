-- ==========================================================
-- 006_users.sql
--
-- End users of the public site. There is no login/signup flow.
-- A row is created or updated automatically when a prediction
-- form is submitted, keyed on mobile number (the unique
-- natural key, confirmed with product owner). Email is stored
-- as secondary contact info, not as an identity key.
-- ==========================================================

create table users (
  id                      uuid primary key default gen_random_uuid(),
  name                    varchar(150) not null,
  mobile                  varchar(15) not null unique,
  email                   varchar(255),
  gender                  varchar(20),

  -- Most recent values submitted — convenient for pre-filling
  -- a returning visitor's form; historical values per-submission
  -- live in the predictions table, not here.
  last_category_id        uuid references categories(id),
  last_home_university_id uuid references universities(id),

  is_active               boolean not null default true,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create trigger trg_users_updated_at
  before update on users
  for each row execute function set_updated_at();

-- mobile already has a unique index via the UNIQUE constraint above.
create index idx_users_email on users (email);
create index idx_users_created_at on users (created_at);
