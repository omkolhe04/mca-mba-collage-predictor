-- ==========================================================
-- 001_extensions.sql
-- Required Postgres extensions.
-- pgcrypto provides gen_random_uuid() used as the default for
-- every primary key in this schema, per "Use UUIDs" requirement.
-- pg_trgm enables fast fuzzy/partial text search on college
-- names (used by the college browse/search index later).
-- ==========================================================

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
