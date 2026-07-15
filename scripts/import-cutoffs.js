/**
 * Imports a CAP cutoff JSON file into the database.
 *
 * Usage:
 *   node scripts/import-cutoffs.js path/to/file.json [EXAM_TYPE_CODE]
 *
 * EXAM_TYPE_CODE defaults to MCA_CET. This script goes through
 * the normal app config (src/config/env.js / supabase.js), which
 * already loads .env — same SUPABASE_URL / SERVICE_ROLE_KEY the
 * running app uses, not a separate DATABASE_URL like the
 * migration scripts.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { importCutoffData } = require('../src/services/import/cutoffImport.service');

const MAX_INVALID_ROWS_TO_PRINT = 20;

async function main() {
  const filePath = process.argv[2];
  const examTypeCode = process.argv[3] || 'MCA_CET';

  if (!filePath) {
    console.error('Usage: node scripts/import-cutoffs.js path/to/file.json [EXAM_TYPE_CODE]');
    process.exit(1);
  }

  const resolvedPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`File not found: ${resolvedPath}`);
    process.exit(1);
  }

  console.log(`Reading ${resolvedPath} ...`);
  const raw = fs.readFileSync(resolvedPath, 'utf8');

  let rows;
  try {
    rows = JSON.parse(raw);
  } catch (err) {
    console.error(`File is not valid JSON: ${err.message}`);
    process.exit(1);
  }

  console.log(`Importing ${Array.isArray(rows) ? rows.length : '?'} rows as exam type "${examTypeCode}" ...\n`);

  const report = await importCutoffData(examTypeCode, rows, { filename: path.basename(resolvedPath) });

  console.log('=== Import Report ===');
  console.log(`Total rows in file:   ${report.totalRows}`);
  console.log(`Valid rows:           ${report.validRowCount}`);
  console.log(`Invalid rows:         ${report.invalidRowCount}`);
  console.log(`Colleges created/updated: ${report.collegesUpserted}`);
  console.log(`Branches created/updated: ${report.branchesUpserted}`);
  console.log(`Cutoff rows written:      ${report.cutoffsUpserted}`);
  if (report.duplicateRowsCollapsed > 0) {
    console.log(`Duplicate rows collapsed: ${report.duplicateRowsCollapsed} (same college/branch/round/category/section/stage appeared more than once — last value kept)`);
  }

  if (report.invalidRowCount > 0) {
    console.log(`\n=== Invalid Rows (showing up to ${MAX_INVALID_ROWS_TO_PRINT}) ===`);
    report.invalidRows.slice(0, MAX_INVALID_ROWS_TO_PRINT).forEach((invalid) => {
      console.log(`  Row ${invalid.index}: ${invalid.errors.join('; ')}`);
    });
    if (report.invalidRows.length > MAX_INVALID_ROWS_TO_PRINT) {
      console.log(`  ... and ${report.invalidRows.length - MAX_INVALID_ROWS_TO_PRINT} more`);
    }
    console.log('\nThese rows were skipped. Fix them in the source file and re-run to import them —');
    console.log('re-running is always safe, already-imported rows are updated, not duplicated.');
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('\nImport failed:', err.message);
  process.exit(1);
});
