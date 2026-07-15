'use strict';

/**
 * ===========================================================
 * "LOW CHANCE" DISPLAY FILTER — CONFIGURATION
 * ===========================================================
 *
 * IMPORTANT — this is a DISPLAY filter only, the exact same kind
 * as veryHighDisplayThresholds.js. It does not affect:
 *   - Which chance bucket a college is classified into
 *   - The difference calculation (student percentile − cutoff)
 *   - Any other prediction logic
 *
 * All it does: within the "Low" bucket specifically, decide
 * whether a college is *shown*, based on how far ABOVE the
 * student's own percentile its cutoff sits. A college with a
 * technically-correct "Low" classification but a cutoff wildly
 * out of reach (e.g. cutoff 99.6 for an 88.5-percentile student)
 * is real and accurate, but not a realistic stretch target —
 * this filter hides it without changing anything about how it
 * was computed.
 *
 * Maximum Display Cutoff = studentPercentile + LOW_DISPLAY_MARGIN
 *
 * Applied at DISPLAY time (see predictionResult.service.js),
 * not baked into the engine's stored result_snapshot — so
 * adjusting this margin later takes effect immediately for every
 * existing prediction, not just newly-computed ones.
 */
const DEFAULT_MARGIN = 5;

/**
 * Per-exam overrides, keyed by exam_types.code (e.g. 'MBA_CET').
 * Empty for now — every exam uses DEFAULT_MARGIN until a specific
 * exam actually needs its own value, at which point it's added
 * here without touching any business logic elsewhere.
 *
 * Example of what adding one would look like:
 *   MBA_CET: 4,
 */
const MARGIN_BY_EXAM_CODE = {};

function getMarginForExam(examTypeCode) {
  const margin = MARGIN_BY_EXAM_CODE[examTypeCode];
  return typeof margin === 'number' ? margin : DEFAULT_MARGIN;
}

/**
 * Returns true if a college with this cutoff should be shown in
 * the Low Chance section for a student at this percentile —
 * i.e. its cutoff doesn't exceed the student's own percentile
 * plus the configured margin. Never throws — an unrecognized
 * exam code just falls back to DEFAULT_MARGIN.
 */
function shouldShowInLow(studentPercentile, cutoffPercentile, examTypeCode) {
  const margin = getMarginForExam(examTypeCode);
  return cutoffPercentile <= studentPercentile + margin;
}

module.exports = { shouldShowInLow, DEFAULT_MARGIN, MARGIN_BY_EXAM_CODE };
