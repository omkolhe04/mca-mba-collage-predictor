'use strict';

const supabase = require('../config/supabase');
const { unwrap } = require('./base.repository');
const AppError = require('../utils/AppError');

/**
 * NOTE ON SCALE: both queries below use `.in(branchIds)`, which
 * Supabase sends as a query-string filter. With a few hundred
 * branches (realistic for MCA CET statewide) this is fine. If
 * Phase 8's import brings in Engineering-scale data (thousands
 * of branches), this may need to move to a Postgres RPC/view
 * instead of an `.in()` filter to avoid URL-length limits.
 * Flagging now so it isn't a surprise later.
 */

/**
 * Most recent year that has any cutoff data for the given
 * branches. The engine always predicts against the latest
 * available year.
 */
async function findLatestYear(branchIds) {
  if (!branchIds || branchIds.length === 0) {
    return null;
  }
  const result = await supabase
    .from('cutoffs')
    .select('year')
    .in('branch_id', branchIds)
    .order('year', { ascending: false })
    .limit(1)
    .maybeSingle();
  const row = unwrap(result);
  return row ? row.year : null;
}

/**
 * All cutoff rows for the given branches, year, and set of
 * eligible category ids (the student's base category plus any
 * special reservations they qualify for). This is the engine's
 * primary data pull — everything else is in-memory grouping.
 */
async function findByBranchesYearAndCategories(branchIds, year, categoryIds) {
  if (!branchIds || branchIds.length === 0 || !categoryIds || categoryIds.length === 0) {
    return [];
  }
  const result = await supabase
    .from('cutoffs')
    .select('branch_id, round, category_id, cutoff_percentile, seat_pool, seat_gender_type')
    .in('branch_id', branchIds)
    .eq('year', year)
    .in('category_id', categoryIds);
  return unwrap(result) || [];
}

/**
 * All cutoff rows for the given branches and year, across every
 * category and round — used by the College Details page to show
 * the full officially published cutoff table, not just the
 * categories one particular student is eligible for.
 */
async function findByBranchesAndYear(branchIds, year) {
  if (!branchIds || branchIds.length === 0 || !year) {
    return [];
  }
  const result = await supabase
    .from('cutoffs')
    .select('branch_id, round, category_id, cutoff_percentile, cutoff_rank')
    .in('branch_id', branchIds)
    .eq('year', year);
  return unwrap(result) || [];
}

// Keeps individual upsert requests well within PostgREST/reverse
// proxy payload and URL-length limits when importing a full
// year's cutoff data (potentially thousands of rows at once).
const UPSERT_CHUNK_SIZE = 500;

/**
 * Bulk create-or-update cutoff rows, chunked. Relies on the
 * unique constraint (college_id, branch_id, year, round,
 * category_id, section, stage) — see migration 017 for why
 * section/stage had to become NOT NULL for this to reliably
 * prevent duplicates on re-import.
 */
async function upsertMany(cutoffRows) {
  if (!cutoffRows || cutoffRows.length === 0) {
    return 0;
  }

  let totalUpserted = 0;
  for (let i = 0; i < cutoffRows.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = cutoffRows.slice(i, i + UPSERT_CHUNK_SIZE);
    const result = await supabase
      .from('cutoffs')
      .upsert(chunk, { onConflict: 'college_id,branch_id,year,round,category_id,section,stage' })
      .select('id');
    const data = unwrap(result) || [];
    totalUpserted += data.length;
  }
  return totalUpserted;
}

/**
 * Deletes every cutoff row tagged with the given import batch —
 * used when an admin deletes an import from the history list.
 * Returns how many rows were deleted, so the admin gets clear
 * confirmation of what just happened.
 */
async function deleteByImportBatchId(importBatchId) {
  const result = await supabase.from('cutoffs').delete().eq('import_batch_id', importBatchId).select('id');
  if (result.error) {
    throw AppError.internal(`Database error: ${result.error.message}`);
  }
  return (result.data || []).length;
}

module.exports = {
  findLatestYear,
  findByBranchesYearAndCategories,
  findByBranchesAndYear,
  upsertMany,
  deleteByImportBatchId,
};
