/**
 * Runs every .sql file in database/migrations/, in filename
 * order, against the database — but only the ones that haven't
 * already been applied. Tracks applied migrations in a
 * `schema_migrations` table (created automatically on first
 * run), so this is safe to re-run any time new migration files
 * are added later — it will only apply what's new.
 *
 * This uses a direct Postgres connection (DATABASE_URL), NOT
 * the Supabase JS client — supabase-js talks to PostgREST and
 * cannot execute arbitrary DDL like CREATE TABLE. Get the
 * connection string from: Supabase Dashboard -> Project
 * Settings -> Database -> Connection string (URI, "Session
 * pooler" or direct connection both work for this one-off task).
 *
 * Usage:
 *   DATABASE_URL="postgres://...supabase..." node database/run-migrations.js
 *
 * This script is a one-time/occasional admin task, not part of
 * the running application, which is why `pg` lives in
 * devDependencies rather than the app's runtime dependencies.
 */
'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function ensureTrackingTable(client) {
  await client.query(`
    create table if not exists schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    );
  `);
}

async function getAppliedFilenames(client) {
  const result = await client.query('select filename from schema_migrations');
  return new Set(result.rows.map((row) => row.filename));
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is required. See comment at top of this file for where to find it.');
    process.exit(1);
  }

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort(); // filenames are zero-padded (001_, 002_...) so lexical sort == execution order

  if (files.length === 0) {
    console.log('No migration files found.');
    return;
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    await ensureTrackingTable(client);
    const applied = await getAppliedFilenames(client);

    const pending = files.filter((f) => !applied.has(f));
    if (pending.length === 0) {
      console.log('Nothing to do — all migrations already applied.');
      return;
    }

    console.log(`${applied.size} already applied, ${pending.length} pending.\n`);

    for (const file of pending) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      process.stdout.write(`Applying ${file} ... `);
      try {
        await client.query('begin');
        await client.query(sql);
        await client.query('insert into schema_migrations (filename) values ($1)', [file]);
        await client.query('commit');
        console.log('OK');
      } catch (err) {
        await client.query('rollback');
        console.log('FAILED');
        console.error(err.message);
        process.exit(1);
      }
    }
    console.log('\nAll pending migrations applied successfully.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Migration runner crashed:', err);
  process.exit(1);
});
