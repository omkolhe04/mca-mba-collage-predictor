'use strict';

const { decodeCategoryCode, classifySeatPool } = require('./categoryDecoder');

/**
 * ===========================================================
 * IMPORT VALIDATORS — pure functions, no I/O.
 * ===========================================================
 *
 * Handles two jobs:
 *   1. NORMALIZATION — real-world source files (government
 *      exports, spreadsheet-to-JSON conversions) are rarely
 *      key-consistent. This tolerates "College Code",
 *      "college_code", "CollegeCode", etc. all meaning the same
 *      thing, rather than assuming one exact format we haven't
 *      actually seen a real sample of yet.
 *   2. VALIDATION — every row is checked independently. A bad
 *      row is rejected with a clear reason; it never blocks the
 *      good rows in the same file from importing.
 * ===========================================================
 */

const FIELD_ALIASES = {
  year: ['year'],
  round: ['round', 'capround', 'caproundno'],
  collegeCode: ['collegecode', 'institutecode', 'clgcode', 'collegecd'],
  collegeName: ['collegename', 'institutename', 'clgname'],
  branchCode: ['branchcode', 'coursecode', 'branchcd'],
  branch: ['branch', 'branchname', 'coursename', 'course'],
  status: ['status', 'seatstatus'],
  section: ['section'],
  stage: ['stage'],
  category: ['category', 'categorycode', 'cat'],
  cutoffRank: ['cutoffrank', 'rank'],
  percentile: ['percentile', 'cutoffpercentile', 'percentage'],
};

const ROUND_ALIASES = {
  cap1: 'CAP1',
  caproundi: 'CAP1',
  capround1: 'CAP1',
  round1: 'CAP1',
  r1: 'CAP1',
  '1': 'CAP1',
  cap2: 'CAP2',
  caproundii: 'CAP2',
  capround2: 'CAP2',
  round2: 'CAP2',
  r2: 'CAP2',
  '2': 'CAP2',
  cap3: 'CAP3',
  caproundiii: 'CAP3',
  capround3: 'CAP3',
  round3: 'CAP3',
  r3: 'CAP3',
  '3': 'CAP3',
  cap4: 'CAP4',
  caproundiv: 'CAP4',
  capround4: 'CAP4',
  round4: 'CAP4',
  r4: 'CAP4',
  '4': 'CAP4',
};

function normalizeKey(key) {
  return String(key).toLowerCase().replace(/[\s_-]/g, '');
}

/**
 * Maps a raw row's arbitrarily-cased/spaced keys onto our
 * canonical field names, using FIELD_ALIASES. Unrecognized keys
 * in the source row are simply ignored.
 */
function normalizeRawRow(rawRow) {
  const lookup = {};
  for (const [key, value] of Object.entries(rawRow)) {
    lookup[normalizeKey(key)] = value;
  }

  const normalized = {};
  for (const [canonicalField, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const alias of aliases) {
      if (lookup[alias] !== undefined && lookup[alias] !== null) {
        normalized[canonicalField] = lookup[alias];
        break;
      }
    }
  }
  return normalized;
}

/**
 * Normalizes a round value to one of 'CAP1'..'CAP4'. Returns
 * null if the value doesn't match any known alias — the row is
 * then rejected with a clear error rather than guessed at.
 */
function normalizeRound(value) {
  if (value === undefined || value === null) return null;
  const key = String(value).toLowerCase().replace(/[\s_-]/g, '');
  return ROUND_ALIASES[key] || null;
}

/**
 * Validates one normalized row. `categoryCodeToId` is a Map of
 * uppercase category code -> category UUID, resolved once per
 * import run from the categories table (categories are a
 * controlled admin-managed lookup — an unrecognized category
 * code in the file is a validation error, not something the
 * importer silently creates).
 */
function validateRow(normalized, categoryCodeToId) {
  const errors = [];

  const year = parseInt(normalized.year, 10);
  if (normalized.year === undefined || Number.isNaN(year) || year < 2000 || year > 2100) {
    errors.push(`Invalid or missing year: "${normalized.year}"`);
  }

  const round = normalizeRound(normalized.round);
  if (!round) {
    errors.push(`Unrecognized round value: "${normalized.round}"`);
  }

  const collegeCode = normalized.collegeCode !== undefined ? String(normalized.collegeCode).trim() : '';
  if (!collegeCode) errors.push('Missing college code');

  const collegeName = normalized.collegeName !== undefined ? String(normalized.collegeName).trim() : '';
  if (!collegeName) errors.push('Missing college name');

  const branchCode = normalized.branchCode !== undefined ? String(normalized.branchCode).trim() : '';
  if (!branchCode) errors.push('Missing branch code');

  const branch = normalized.branch !== undefined ? String(normalized.branch).trim() : '';
  if (!branch) errors.push('Missing branch name');

  const categoryRaw = normalized.category !== undefined ? String(normalized.category).trim() : '';
  let categoryId = null;
  let resolvedCategoryCode = null;
  let seatGenderType = null;
  if (!categoryRaw) {
    errors.push('Missing category');
  } else {
    const decoded = decodeCategoryCode(categoryRaw);
    resolvedCategoryCode = decoded.resolvedCode;
    seatGenderType = decoded.genderType;
    if (!resolvedCategoryCode) {
      errors.push(`Unrecognized category code: "${categoryRaw}"`);
    } else {
      categoryId = categoryCodeToId.get(resolvedCategoryCode) || null;
      if (!categoryId) {
        errors.push(
          `Category "${resolvedCategoryCode}" (decoded from "${categoryRaw}") not found in categories table`
        );
      }
    }
  }

  const seatPool = classifySeatPool(normalized.section);

  let cutoffRank = null;
  if (normalized.cutoffRank !== undefined && normalized.cutoffRank !== '') {
    cutoffRank = parseInt(normalized.cutoffRank, 10);
    if (Number.isNaN(cutoffRank)) {
      errors.push(`Invalid cutoff rank: "${normalized.cutoffRank}"`);
      cutoffRank = null;
    }
  }

  let percentile = null;
  if (normalized.percentile !== undefined && normalized.percentile !== '') {
    percentile = parseFloat(normalized.percentile);
    if (Number.isNaN(percentile) || percentile < 0 || percentile > 100) {
      errors.push(`Invalid percentile: "${normalized.percentile}"`);
      percentile = null;
    }
  }

  if (cutoffRank === null && percentile === null) {
    errors.push('Row has neither a valid cutoff rank nor a valid percentile');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    data: {
      year,
      round,
      collegeCode,
      collegeName,
      branchCode,
      branch,
      status: normalized.status !== undefined ? String(normalized.status).trim() : '',
      section: normalized.section !== undefined ? String(normalized.section).trim() : '',
      stage: normalized.stage !== undefined ? String(normalized.stage).trim() : '',
      categoryId,
      categoryCode: resolvedCategoryCode,
      rawCategoryCode: categoryRaw,
      seatPool,
      seatGenderType,
      cutoffRank,
      percentile,
    },
  };
}

module.exports = {
  FIELD_ALIASES,
  ROUND_ALIASES,
  normalizeKey,
  normalizeRawRow,
  normalizeRound,
  validateRow,
};
