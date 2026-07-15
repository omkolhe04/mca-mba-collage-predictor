'use strict';

/**
 * ===========================================================
 * "VERY HIGH CHANCE" DISPLAY FILTER — CONFIGURATION
 * ===========================================================
 *
 * IMPORTANT — this is a DISPLAY filter only. It does not affect:
 *   - Which chance bucket a college is classified into (that's
 *     still decided entirely by predictionEngine.service.js's
 *     classifyChance(), using the existing +5/+2/-2 thresholds)
 *   - The difference calculation (student percentile − cutoff)
 *   - Any other prediction logic
 *
 * All it does: within the "Very High" bucket specifically,
 * decide whether a given college is *shown* to the student,
 * based on how close its cutoff is to the student's own
 * percentile. A college with a technically-correct "Very High"
 * classification but a cutoff far below the student's level
 * (e.g. cutoff 12 for a 90-percentile student) is real and
 * accurate, but not useful to show as a top recommendation —
 * this filter hides it from that section without changing
 * anything about how it was computed.
 *
 * Applied at DISPLAY time (see predictionResult.service.js),
 * not baked into the engine's stored result_snapshot — so
 * adjusting these thresholds later takes effect immediately for
 * every existing prediction, not just newly-computed ones.
 *
 * Rules are checked in the order listed, and the first one
 * whose `minPercentile` the student meets or exceeds is used —
 * so keep this list ordered from highest to lowest.
 */
const DEFAULT_RULES = [
  { minPercentile: 95, minCutoff: 90 },
  { minPercentile: 90, minCutoff: 85 },
  { minPercentile: 80, minCutoff: 75 },
  { minPercentile: 70, minCutoff: 65 },
  { minPercentile: 60, minCutoff: 55 },
  { minPercentile: 50, minCutoff: 45 },
  { minPercentile: 0, minCutoff: 0 }, // below 50 — show every Very High college
];

/**
 * Per-exam overrides, keyed by exam_types.code (e.g. 'MBA_CET').
 * Empty for now — every exam uses DEFAULT_RULES until a specific
 * exam actually needs its own table, at which point it's added
 * here without touching any business logic elsewhere.
 *
 * Example of what adding one would look like:
 *   MBA_CET: [
 *     { minPercentile: 95, minCutoff: 88 },
 *     ...
 *   ],
 */
const RULES_BY_EXAM_CODE = {};

function getRulesForExam(examTypeCode) {
  return RULES_BY_EXAM_CODE[examTypeCode] || DEFAULT_RULES;
}

/**
 * Returns true if a college with this cutoff should be shown in
 * the Very High Chance section for a student at this percentile.
 * Never throws — an unrecognized exam code just falls back to
 * DEFAULT_RULES, and a percentile below every configured tier
 * (the `minPercentile: 0` row) always shows everything, per spec.
 */
function shouldShowInVeryHigh(studentPercentile, cutoffPercentile, examTypeCode) {
  const rules = getRulesForExam(examTypeCode);
  const rule = rules.find((r) => studentPercentile >= r.minPercentile);
  if (!rule) return true;
  return cutoffPercentile >= rule.minCutoff;
}

module.exports = { shouldShowInVeryHigh, DEFAULT_RULES, RULES_BY_EXAM_CODE };
