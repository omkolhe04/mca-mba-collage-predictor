'use strict';

const categoryRepository = require('../repositories/category.repository');
const collegeRepository = require('../repositories/college.repository');
const collegeBranchRepository = require('../repositories/collegeBranch.repository');
const cutoffRepository = require('../repositories/cutoff.repository');
const examTypeRepository = require('../repositories/examType.repository');
const { generateRoundCodes, CHANCE_THRESHOLDS, SPECIAL_CATEGORY_CODE_BY_FLAG } = require('../utils/constants');

/**
 * ===========================================================
 * PREDICTION ENGINE
 * ===========================================================
 *
 * Given a prediction's inputs (percentile, category, special
 * reservations, dream college), works out — for each of the 4
 * CAP rounds independently — which chance band every college
 * falls into.
 *
 * CORE RULE
 * ---------
 * For a college/branch/round, difference = studentPercentile -
 * cutoffPercentile. A positive difference means the student
 * scored above that round's cutoff.
 *   difference >= 5   -> Very High chance
 *   2 <= diff < 5      -> High chance
 *  -2 <= diff < 2      -> Moderate chance
 *   diff < -2          -> Low chance
 *
 * MULTI-CATEGORY ELIGIBILITY
 * ---------------------------
 * A student isn't only evaluated against their base category
 * (e.g. OBC) — if they also qualify for a special reservation
 * they ticked (TFWS/EWS/Minority/Defence/PwD), the engine checks
 * that category's cutoff too, and uses whichever gives the more
 * favorable (highest) chance for that college/branch/round. This
 * mirrors how CAP admission genuinely works: a candidate is
 * admitted via whichever eligible category/quota gets them in.
 *
 * MISSING DATA
 * ------------
 * A college/round with no cutoff row for any of the student's
 * eligible categories goes into that round's `noData` bucket,
 * rather than being silently dropped or guessed at.
 *
 * SEAT-POOL ELIGIBILITY
 * ----------------------
 * Real CAP cutoff data splits seats into pools — Home University
 * (for candidates from that college's affiliating university),
 * Other-Than-Home-University, State Level, and Minority — and a
 * student is only genuinely eligible for some of them depending
 * on whether their home university matches the college's. A
 * Ladies-only ('L') seat similarly only applies to female
 * candidates. The engine filters out ineligible rows before
 * picking each college/round's "best" cutoff, so it doesn't show
 * a favorable cutoff from a pool the student couldn't actually
 * compete in. When a college's affiliating university hasn't
 * been set by an admin yet (colleges.university_id is null), or
 * a row's seat_pool couldn't be classified, eligibility can't be
 * determined — the engine falls back to treating it as eligible
 * rather than wrongly excluding it.
 *
 * This module is pure business logic — no HTTP, no request/
 * response. It's called from prediction.service.js.
 * ===========================================================
 */

const CHANCE_BUCKET_KEYS = ['veryHigh', 'high', 'moderate', 'low'];

function classifyChance(difference) {
  if (difference >= CHANCE_THRESHOLDS.VERY_HIGH) return 'veryHigh';
  if (difference >= CHANCE_THRESHOLDS.HIGH) return 'high';
  if (difference >= CHANCE_THRESHOLDS.MODERATE) return 'moderate';
  return 'low';
}

// Rounds to 7 decimal places to match the numeric(10,7) columns
// this data comes from, avoiding floating-point display noise.
function round7(value) {
  return Math.round(value * 1e7) / 1e7;
}

function emptyRoundsMap(roundCodes) {
  const rounds = {};
  for (const roundCode of roundCodes) {
    rounds[roundCode] = { veryHigh: [], high: [], moderate: [], low: [], noData: [] };
  }
  return rounds;
}

function buildEmptySnapshot({ eligibleCategoryCodes, note, roundCodes, examTypeCode }) {
  return {
    engineVersion: 1,
    computedAt: new Date().toISOString(),
    examYear: null,
    examTypeCode,
    roundCodes,
    eligibleCategories: eligibleCategoryCodes,
    totalCollegesEvaluated: 0,
    rounds: emptyRoundsMap(roundCodes),
    dreamCollege: null,
    recommendedPreferenceOrder: [],
    note,
  };
}

/**
 * Works out every category id the student should be evaluated
 * against: their base selected category, plus one per special
 * reservation flag that's set to true.
 */
async function resolveEligibleCategories(prediction) {
  const baseCategory = await categoryRepository.findById(prediction.category_id);

  const specialCodes = [];
  for (const [flag, code] of Object.entries(SPECIAL_CATEGORY_CODE_BY_FLAG)) {
    if (prediction[flag]) {
      specialCodes.push(code);
    }
  }

  const specialCategories = specialCodes.length ? await categoryRepository.findManyByCodes(specialCodes) : [];

  const eligibleCategories = [baseCategory, ...specialCategories].filter(Boolean);
  // De-duplicate in case a special code somehow equals the base category.
  const seen = new Set();
  return eligibleCategories.filter((cat) => {
    if (seen.has(cat.id)) return false;
    seen.add(cat.id);
    return true;
  });
}

/**
 * Whether a student is actually eligible for a given cutoff row,
 * based on seat pool (Home/Other University, State Level,
 * Minority) and gender-restricted (Ladies-only) seats. Falls
 * back to "eligible" whenever eligibility can't be determined
 * (unknown pool, or the college's affiliating university hasn't
 * been set) rather than wrongly excluding a row.
 */
function isRowEligible(row, collegeUniversityId, studentHomeUniversityId, studentGender) {
  if (row.seat_gender_type === 'L' && studentGender !== 'Female') {
    return false;
  }

  const pool = row.seat_pool;
  if (!pool || pool === 'UNKNOWN' || pool === 'STATE_LEVEL' || pool === 'MINORITY' || pool === 'OTHER_TO_HOME') {
    return true;
  }

  if (!collegeUniversityId || !studentHomeUniversityId) {
    return true; // can't determine a home-university match — permissive fallback
  }

  const isHomeMatch = studentHomeUniversityId === collegeUniversityId;
  if (pool === 'HOME_TO_HOME') return isHomeMatch;
  if (pool === 'HOME_TO_OTHER' || pool === 'OTHER_TO_OTHER') return !isHomeMatch;
  return true;
}

/**
 * For every (branch, round) combination, finds the single best
 * (highest-difference) cutoff match across all eligible
 * categories AND eligible seat pools. Returns a Map keyed by
 * `${branchId}|${round}`.
 */
function computeBestMatchPerBranchRound(
  cutoffRows,
  studentPercentile,
  branchUniversityId,
  studentHomeUniversityId,
  studentGender
) {
  const bestByKey = new Map();

  for (const row of cutoffRows) {
    if (row.cutoff_percentile === null || row.cutoff_percentile === undefined) {
      // v1 engine matches on percentile only; rank-only rows are
      // skipped rather than guessed at.
      continue;
    }

    const collegeUniversityId = branchUniversityId.get(row.branch_id) || null;
    if (!isRowEligible(row, collegeUniversityId, studentHomeUniversityId, studentGender)) {
      continue;
    }

    const cutoffPercentile = Number(row.cutoff_percentile);
    const difference = studentPercentile - cutoffPercentile;
    const key = `${row.branch_id}|${row.round}`;
    const existing = bestByKey.get(key);

    if (!existing || difference > existing.difference) {
      bestByKey.set(key, {
        cutoffPercentile,
        difference,
        categoryId: row.category_id,
      });
    }
  }

  return bestByKey;
}

/**
 * Main entry point. `prediction` is a full row from the
 * predictions table (already inserted with its inputs).
 */
async function runEngine(prediction) {
  const studentPercentile = Number(prediction.percentile);

  const examType = await examTypeRepository.findById(prediction.exam_type_id);
  const roundCodes = generateRoundCodes(examType ? examType.cap_rounds : 4);

  const eligibleCategories = await resolveEligibleCategories(prediction);
  const eligibleCategoryIds = eligibleCategories.map((c) => c.id);
  const eligibleCategoryById = new Map(eligibleCategories.map((c) => [c.id, c]));
  const eligibleCategoryCodes = eligibleCategories.map((c) => c.code);

  const colleges = await collegeRepository.findAllActiveByExamType(prediction.exam_type_id);
  if (colleges.length === 0) {
    return buildEmptySnapshot({
      eligibleCategoryCodes,
      roundCodes,
      examTypeCode: examType ? examType.code : null,
      note: 'No colleges have been loaded for this exam yet.',
    });
  }
  const collegeById = new Map(colleges.map((c) => [c.id, c]));

  const branches = await collegeBranchRepository.findActiveByCollegeIds(colleges.map((c) => c.id));
  if (branches.length === 0) {
    return buildEmptySnapshot({
      eligibleCategoryCodes,
      roundCodes,
      examTypeCode: examType ? examType.code : null,
      note: 'No branch data has been loaded for these colleges yet.',
    });
  }
  const branchIds = branches.map((b) => b.id);

  const examYear = await cutoffRepository.findLatestYear(branchIds);
  if (!examYear) {
    return buildEmptySnapshot({
      eligibleCategoryCodes,
      roundCodes,
      examTypeCode: examType ? examType.code : null,
      note: 'No CAP cutoff data has been imported yet.',
    });
  }

  const cutoffRows = await cutoffRepository.findByBranchesYearAndCategories(
    branchIds,
    examYear,
    eligibleCategoryIds
  );

  // Maps each branch to its owning college's affiliating
  // university (set by an admin via Manage Colleges) — used to
  // determine Home-vs-Other-University seat-pool eligibility.
  // A branch whose college has no university_id set yet simply
  // maps to null, which isRowEligible() treats permissively.
  const branchUniversityId = new Map(
    branches.map((b) => [b.id, collegeById.get(b.college_id)?.university_id || null])
  );

  const bestByKey = computeBestMatchPerBranchRound(
    cutoffRows,
    studentPercentile,
    branchUniversityId,
    prediction.home_university_id,
    prediction.gender
  );

  const rounds = emptyRoundsMap(roundCodes);

  for (const branch of branches) {
    const college = collegeById.get(branch.college_id);
    if (!college) continue;

    for (const roundCode of roundCodes) {
      const best = bestByKey.get(`${branch.id}|${roundCode}`);
      const baseEntry = {
        collegeId: college.id,
        collegeName: college.name,
        city: college.city,
        branchName: branch.branch_name,
      };

      if (!best) {
        rounds[roundCode].noData.push(baseEntry);
        continue;
      }

      const bucket = classifyChance(best.difference);
      const matchedCategory = eligibleCategoryById.get(best.categoryId);

      rounds[roundCode][bucket].push({
        ...baseEntry,
        cutoffPercentile: round7(best.cutoffPercentile),
        difference: round7(best.difference),
        matchedCategoryCode: matchedCategory ? matchedCategory.code : null,
      });
    }
  }

  // Within each bucket, most comfortable margin first.
  for (const roundCode of roundCodes) {
    for (const bucketKey of CHANCE_BUCKET_KEYS) {
      rounds[roundCode][bucketKey].sort((a, b) => b.difference - a.difference);
    }
    rounds[roundCode].noData.sort((a, b) => a.collegeName.localeCompare(b.collegeName));
  }

  // ---- Dream college detail, all 4 rounds ----
  let dreamCollege = null;
  if (prediction.dream_college_id && collegeById.has(prediction.dream_college_id)) {
    const college = collegeById.get(prediction.dream_college_id);
    const collegeBranches = branches.filter((b) => b.college_id === college.id);

    const dreamRounds = {};
    for (const roundCode of roundCodes) {
      let best = null;
      for (const branch of collegeBranches) {
        const candidate = bestByKey.get(`${branch.id}|${roundCode}`);
        if (candidate && (!best || candidate.difference > best.difference)) {
          best = candidate;
        }
      }
      if (best) {
        const matchedCategory = eligibleCategoryById.get(best.categoryId);
        dreamRounds[roundCode] = {
          chance: classifyChance(best.difference),
          cutoffPercentile: round7(best.cutoffPercentile),
          difference: round7(best.difference),
          matchedCategoryCode: matchedCategory ? matchedCategory.code : null,
        };
      } else {
        dreamRounds[roundCode] = null;
      }
    }

    dreamCollege = {
      collegeId: college.id,
      collegeName: college.name,
      city: college.city,
      rounds: dreamRounds,
    };
  }

  // ---- Recommended CAP preference order ----
  // Basis: dream college always listed first (aim high, since
  // CAP auto-allocates your best achievable preference anyway).
  // Everything else follows CAP Round 1 chance, safest margin
  // first within each band. This is a first-pass, clearly
  // documented heuristic — reasonable people could order this
  // differently, so it's easy to find and adjust here.
  const recommendedPreferenceOrder = [];
  const usedCollegeIds = new Set();

  if (dreamCollege) {
    recommendedPreferenceOrder.push({
      collegeId: dreamCollege.collegeId,
      collegeName: dreamCollege.collegeName,
      basis: 'dream_college',
      round1Chance: dreamCollege.rounds.CAP1 ? dreamCollege.rounds.CAP1.chance : null,
    });
    usedCollegeIds.add(dreamCollege.collegeId);
  }

  const round1 = rounds.CAP1;
  for (const bucketKey of CHANCE_BUCKET_KEYS) {
    for (const entry of round1[bucketKey]) {
      if (usedCollegeIds.has(entry.collegeId)) continue;
      recommendedPreferenceOrder.push({
        collegeId: entry.collegeId,
        collegeName: entry.collegeName,
        basis: 'round1_chance',
        round1Chance: bucketKey,
      });
      usedCollegeIds.add(entry.collegeId);
    }
  }

  recommendedPreferenceOrder.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  return {
    engineVersion: 1,
    computedAt: new Date().toISOString(),
    examYear,
    examTypeCode: examType ? examType.code : null,
    roundCodes,
    eligibleCategories: eligibleCategoryCodes,
    totalCollegesEvaluated: colleges.length,
    rounds,
    dreamCollege,
    recommendedPreferenceOrder,
  };
}

module.exports = { runEngine, classifyChance, isRowEligible, computeBestMatchPerBranchRound };
