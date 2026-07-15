'use strict';

const collegeRepository = require('../repositories/college.repository');
const collegeBranchRepository = require('../repositories/collegeBranch.repository');
const universityRepository = require('../repositories/university.repository');
const placementRepository = require('../repositories/placement.repository');
const feeRepository = require('../repositories/fee.repository');
const cutoffRepository = require('../repositories/cutoff.repository');
const categoryRepository = require('../repositories/category.repository');
const examTypeRepository = require('../repositories/examType.repository');
const { generateRoundCodes } = require('../utils/constants');

const STANDARD_FEE_KEY = 'STANDARD';

/**
 * Groups raw cutoff rows into one table per branch:
 *   branch -> [ { categoryCode, categoryName, cells: [round1, round2, round3, round4] } ]
 * Categories are sorted by their configured display_order, and
 * only categories that actually have at least one cutoff row for
 * this college/year are included — an empty category row would
 * add nothing but clutter.
 */
function buildCutoffTables(branches, cutoffRows, categoryById, roundCodes) {
  const byBranch = new Map();
  for (const row of cutoffRows) {
    if (!byBranch.has(row.branch_id)) {
      byBranch.set(row.branch_id, new Map());
    }
    const byCategory = byBranch.get(row.branch_id);
    if (!byCategory.has(row.category_id)) {
      byCategory.set(row.category_id, new Map());
    }
    byCategory.get(row.category_id).set(row.round, row);
  }

  const tables = [];
  for (const branch of branches) {
    const byCategory = byBranch.get(branch.id);
    if (!byCategory || byCategory.size === 0) {
      continue; // no cutoff data at all for this branch — skip its table entirely
    }

    const categoryIds = Array.from(byCategory.keys()).sort((a, b) => {
      const orderA = categoryById.get(a)?.display_order ?? 999;
      const orderB = categoryById.get(b)?.display_order ?? 999;
      return orderA - orderB;
    });

    const rows = categoryIds.map((categoryId) => {
      const category = categoryById.get(categoryId);
      const roundsForCategory = byCategory.get(categoryId);
      const cells = roundCodes.map((roundCode) => {
        const row = roundsForCategory.get(roundCode);
        if (!row) return null;
        return {
          percentile: row.cutoff_percentile !== null ? Number(row.cutoff_percentile) : null,
          rank: row.cutoff_rank !== null ? row.cutoff_rank : null,
        };
      });
      return {
        categoryId,
        categoryCode: category ? category.code : 'Unknown',
        categoryName: category ? category.name : 'Unknown category',
        cells,
      };
    });

    tables.push({ branchId: branch.id, branchName: branch.branch_name, rows });
  }

  return tables;
}

/**
 * Reduces fee rows (already sorted most-recent-year first) to
 * one display row per category (including the standard,
 * no-category fee), labeled with a human-readable name.
 */
function buildFeeRows(feeRows, categoryById) {
  const latestByCategory = new Map();
  for (const row of feeRows) {
    const key = row.category_id || STANDARD_FEE_KEY;
    if (!latestByCategory.has(key)) {
      latestByCategory.set(key, row);
    }
  }

  return Array.from(latestByCategory.entries()).map(([key, row]) => ({
    categoryLabel: key === STANDARD_FEE_KEY ? 'All Categories (Standard)' : categoryById.get(key)?.name || 'Unknown',
    academicYear: row.academic_year,
    annualFee: row.annual_fee !== null ? Number(row.annual_fee) : null,
    totalCourseFee: row.total_course_fee !== null ? Number(row.total_course_fee) : null,
  }));
}

/**
 * Assembles everything the College Details page needs in one
 * call. Returns null if the college doesn't exist (controller
 * renders a 404 in that case).
 */
async function getCollegeDetail(collegeId) {
  const college = await collegeRepository.findFullById(collegeId);
  if (!college) {
    return null;
  }

  const [university, branches, placementRows, feeRows, allCategories, examType] = await Promise.all([
    college.university_id ? universityRepository.findById(college.university_id) : null,
    collegeBranchRepository.findActiveByCollegeIds([collegeId]),
    placementRepository.findByCollegeIds([collegeId]),
    feeRepository.findAllByCollegeId(collegeId),
    categoryRepository.findAll(),
    examTypeRepository.findById(college.exam_type_id),
  ]);

  // A college's CAP round count follows its own exam type (e.g.
  // 4 rounds for an MCA CET college, 3 for an MBA CET college) —
  // never a hardcoded assumption. Falls back to 4 only if the
  // exam type record is somehow missing.
  const roundCodes = generateRoundCodes(examType ? examType.cap_rounds : 4);

  const categoryById = new Map(allCategories.map((c) => [c.id, c]));

  const placement = placementRows.length > 0 ? placementRows[0] : null;
  const fees = buildFeeRows(feeRows, categoryById);

  const branchIds = branches.map((b) => b.id);
  const latestYear = branchIds.length > 0 ? await cutoffRepository.findLatestYear(branchIds) : null;
  const cutoffRows = latestYear ? await cutoffRepository.findByBranchesAndYear(branchIds, latestYear) : [];
  const cutoffTables = buildCutoffTables(branches, cutoffRows, categoryById, roundCodes);

  // Union of every category that appears in any branch's table,
  // sorted by display order — feeds the single category filter
  // dropdown that applies across all tables on the page.
  const filterCategoryIds = new Set();
  for (const table of cutoffTables) {
    for (const row of table.rows) {
      filterCategoryIds.add(row.categoryId);
    }
  }
  const filterCategories = Array.from(filterCategoryIds)
    .map((id) => categoryById.get(id))
    .filter(Boolean)
    .sort((a, b) => a.display_order - b.display_order);

  return {
    college,
    universityName: university ? university.name : null,
    branches,
    placement,
    fees,
    latestYear,
    cutoffTables,
    filterCategories,
    roundCodes,
  };
}

module.exports = { getCollegeDetail };
