'use strict';

const examTypeRepository = require('../../repositories/examType.repository');
const categoryRepository = require('../../repositories/category.repository');
const collegeRepository = require('../../repositories/college.repository');
const collegeBranchRepository = require('../../repositories/collegeBranch.repository');
const cutoffRepository = require('../../repositories/cutoff.repository');
const importBatchRepository = require('../../repositories/importBatch.repository');
const AppError = require('../../utils/AppError');
const { normalizeRawRow, validateRow } = require('./importValidators');

/**
 * Imports a year's worth of CAP cutoff data from a parsed JSON
 * array. Designed to work unchanged for future years — nothing
 * here is year-specific, and colleges/branches are created
 * automatically the first time they're seen in any import file.
 *
 * Safe to re-run: colleges, branches, and cutoff rows are all
 * upserted (create-or-update) rather than blindly inserted, so
 * importing the same file twice — or a corrected version of a
 * file — never creates duplicates.
 *
 * Every run is recorded as an "import batch" (filename, when,
 * by whom, resulting stats), and every cutoff row it writes is
 * tagged with that batch's id — this is what lets an admin later
 * delete just the data one specific import contributed, from the
 * Import History list.
 *
 * @param {string} examTypeCode - e.g. 'MCA_CET'
 * @param {Array<object>} rawRows - parsed JSON array from the source file
 * @param {object} [options]
 * @param {string} [options.filename] - source filename, for the history list
 * @param {string} [options.importedByAdminId] - admin id, null for CLI imports
 * @returns {Promise<object>} an import report
 */
async function importCutoffData(examTypeCode, rawRows, options = {}) {
  const { filename = 'unknown.json', importedByAdminId = null } = options;

  if (!Array.isArray(rawRows)) {
    throw AppError.badRequest('Import file must contain a JSON array of row objects.');
  }

  const examType = await examTypeRepository.findByCode(examTypeCode);
  if (!examType) {
    throw AppError.badRequest(`Unknown exam type code: "${examTypeCode}"`);
  }

  // Created up front (before we know final stats) so its id can
  // be stamped onto every cutoff row this run writes; updated
  // with the real numbers once the import finishes.
  const batch = await importBatchRepository.create({
    exam_type_id: examType.id,
    filename,
    imported_by: importedByAdminId,
  });

  const allCategories = await categoryRepository.findAll();
  const categoryCodeToId = new Map(allCategories.map((c) => [c.code.toUpperCase(), c.id]));

  const validRows = [];
  const invalidRows = [];

  rawRows.forEach((rawRow, index) => {
    const normalized = normalizeRawRow(rawRow);
    const result = validateRow(normalized, categoryCodeToId);
    if (result.valid) {
      validRows.push(result.data);
    } else {
      invalidRows.push({ index, errors: result.errors, raw: rawRow });
    }
  });

  const baseReport = {
    importBatchId: batch.id,
    examTypeCode,
    totalRows: rawRows.length,
    validRowCount: validRows.length,
    invalidRowCount: invalidRows.length,
    invalidRows,
  };

  if (validRows.length === 0) {
    await importBatchRepository.update(batch.id, {
      total_rows: rawRows.length,
      valid_row_count: 0,
      invalid_row_count: invalidRows.length,
    });
    return { ...baseReport, collegesUpserted: 0, branchesUpserted: 0, cutoffsUpserted: 0 };
  }

  // ---- Step 1: upsert colleges (one row per distinct college code) ----
  const collegesByCode = new Map();
  for (const row of validRows) {
    if (!collegesByCode.has(row.collegeCode)) {
      collegesByCode.set(row.collegeCode, {
        exam_type_id: examType.id,
        college_code: row.collegeCode,
        name: row.collegeName,
      });
    }
  }
  const upsertedColleges = await collegeRepository.upsertMany(Array.from(collegesByCode.values()));
  const collegeIdByCode = new Map(upsertedColleges.map((c) => [c.college_code, c.id]));

  // ---- Step 2: upsert branches (one row per distinct college+branch code) ----
  const branchesByKey = new Map();
  for (const row of validRows) {
    const collegeId = collegeIdByCode.get(row.collegeCode);
    if (!collegeId) continue; // shouldn't happen, but never crash an import over it
    const key = `${collegeId}|${row.branchCode}`;
    if (!branchesByKey.has(key)) {
      branchesByKey.set(key, {
        college_id: collegeId,
        branch_code: row.branchCode,
        branch_name: row.branch,
      });
    }
  }
  const upsertedBranches = await collegeBranchRepository.upsertMany(Array.from(branchesByKey.values()));
  const branchIdByKey = new Map(upsertedBranches.map((b) => [`${b.college_id}|${b.branch_code}`, b.id]));

  // ---- Step 3: bulk upsert cutoff rows, tagged with this batch ----
  const cutoffRows = [];
  for (const row of validRows) {
    const collegeId = collegeIdByCode.get(row.collegeCode);
    const branchId = branchIdByKey.get(`${collegeId}|${row.branchCode}`);
    if (!collegeId || !branchId) continue;

    cutoffRows.push({
      college_id: collegeId,
      branch_id: branchId,
      category_id: row.categoryId,
      year: row.year,
      round: row.round,
      status: row.status,
      section: row.section,
      stage: row.stage,
      cutoff_rank: row.cutoffRank,
      cutoff_percentile: row.percentile,
      raw_category_code: row.rawCategoryCode,
      seat_pool: row.seatPool,
      seat_gender_type: row.seatGenderType,
      import_batch_id: batch.id,
    });
  }

  // Postgres rejects a single upsert statement that would update
  // the same conflict-target row twice ("ON CONFLICT DO UPDATE
  // command cannot affect row a second time") — this happens
  // when two source rows decode down to an identical
  // (college, branch, year, round, category, section, stage)
  // combination, which real government data exports sometimes
  // contain. Rather than crash the whole import, duplicates are
  // collapsed (last one wins) and the count is reported so
  // nothing is silently lost without visibility.
  const { rows: dedupedCutoffRows, duplicateCount } = dedupeCutoffRows(cutoffRows);

  const cutoffsUpserted = await cutoffRepository.upsertMany(dedupedCutoffRows);

  await importBatchRepository.update(batch.id, {
    total_rows: rawRows.length,
    valid_row_count: validRows.length,
    invalid_row_count: invalidRows.length,
    colleges_upserted: upsertedColleges.length,
    branches_upserted: upsertedBranches.length,
    cutoffs_upserted: cutoffsUpserted,
    duplicate_rows_collapsed: duplicateCount,
  });

  return {
    ...baseReport,
    collegesUpserted: upsertedColleges.length,
    branchesUpserted: upsertedBranches.length,
    cutoffsUpserted,
    duplicateRowsCollapsed: duplicateCount,
  };
}

/**
 * Collapses rows sharing the same composite unique key down to
 * one (last occurrence wins), returning both the deduplicated
 * list and how many were collapsed.
 */
function dedupeCutoffRows(cutoffRows) {
  const seen = new Map();
  let duplicateCount = 0;

  for (const row of cutoffRows) {
    const key = [row.college_id, row.branch_id, row.year, row.round, row.category_id, row.section, row.stage].join(
      '|'
    );
    if (seen.has(key)) {
      duplicateCount += 1;
    }
    seen.set(key, row); // last occurrence wins
  }

  return { rows: Array.from(seen.values()), duplicateCount };
}

module.exports = { importCutoffData };
