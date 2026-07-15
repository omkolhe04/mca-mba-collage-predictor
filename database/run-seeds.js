/**
 * Runs every .sql file in database/seeds/, in filename order.
 * Seeds use `on conflict ... do nothing`, so this is safe to
 * re-run without creating duplicates.
 *
 * Usage:
 *   DATABASE_URL="postgres://...supabase..." node database/run-seeds.js
 */
'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is required.');
    process.exit(1);
  }

  const seedsDir = path.join(__dirname, 'seeds');
  const files = fs
    .readdirSync(seedsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    for (const file of files) {
      const sql = fs.readFileSync(path.join(seedsDir, file), 'utf8');
      process.stdout.write(`Seeding ${file} ... `);
      await client.query(sql);
      console.log('OK');
    }
    console.log('All seeds applied successfully.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Seed runner crashed:', err);
  process.exit(1);
});
