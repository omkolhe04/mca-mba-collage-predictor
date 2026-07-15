'use strict';

/**
 * Generates round codes for however many CAP rounds a given exam
 * has — e.g. generateRoundCodes(4) -> ['CAP1','CAP2','CAP3','CAP4'],
 * generateRoundCodes(3) -> ['CAP1','CAP2','CAP3'].
 *
 * Replaces what used to be a single hardcoded CAP_ROUNDS = [...]
 * array here, back when only MCA CET (4 rounds) existed. Round
 * count is now per-exam configuration (exam_types.cap_rounds —
 * see migration 022), since MBA CET has 3 rounds, not 4, and
 * future exams may differ again. Every caller that used to import
 * CAP_ROUNDS directly now calls this with the specific exam's
 * configured round count instead.
 *
 * Values match the `round` column values assumed in the cutoffs
 * table (see the comment in database/migrations/009_cutoffs.sql).
 */
function generateRoundCodes(capRoundsCount) {
  const rounds = [];
  for (let i = 1; i <= capRoundsCount; i += 1) {
    rounds.push(`CAP${i}`);
  }
  return rounds;
}

/**
 * Chance classification bands, based on the percentile-point
 * difference between the student's percentile and a college's
 * cutoff percentile (difference = studentPercentile - cutoffPercentile).
 *   difference >= VERY_HIGH        -> Very High chance
 *   HIGH <= difference < VERY_HIGH -> High chance
 *   MODERATE <= difference < HIGH  -> Moderate chance
 *   difference < MODERATE          -> Low chance
 *
 * Shared across every exam type — confirmed with the product
 * owner that MBA CET's chance logic is procedurally identical to
 * MCA CET's, just with different colleges/data/round count, so
 * these bands are not exam-specific.
 */
const CHANCE_THRESHOLDS = {
  VERY_HIGH: 5,
  HIGH: 2,
  MODERATE: -2,
};

/**
 * Maps each special-reservation boolean on a prediction row to
 * the category `code` it corresponds to in the categories table
 * (see database/seeds/002_categories.sql). Used by the engine to
 * work out every category a student is eligible to be evaluated
 * against, beyond their base category. Categories are shared
 * across exam types (state reservation categories don't change
 * based on which entrance exam you're taking).
 */
const SPECIAL_CATEGORY_CODE_BY_FLAG = {
  is_tfws: 'TFWS',
  is_ews: 'EWS',
  is_minority: 'MI',
  is_defence: 'DEFENCE',
  is_pwd: 'PWD',
};

/**
 * Display metadata for each chance bucket — label text and the
 * badge CSS class (defined in public/css/style.css) to use.
 * Colocated with the thresholds above since they describe the
 * same four bands, just for presentation rather than computation.
 */
const CHANCE_BUCKET_META = {
  veryHigh: { label: 'Very High', badgeClass: 'vn-badge-success' },
  high: { label: 'High', badgeClass: 'vn-badge-success' },
  moderate: { label: 'Moderate', badgeClass: 'vn-badge-warning' },
  low: { label: 'Low', badgeClass: 'vn-badge-danger' },
};

module.exports = { generateRoundCodes, CHANCE_THRESHOLDS, SPECIAL_CATEGORY_CODE_BY_FLAG, CHANCE_BUCKET_META };
