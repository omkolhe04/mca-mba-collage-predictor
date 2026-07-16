'use strict';

/**
 * ===========================================================
 * RECOMMENDED PREFERENCE ORDER — CONFIGURATION
 * ===========================================================
 *
 * IMPORTANT — this is a DISPLAY-layer concern only. It does not
 * affect the prediction engine, chance classification, cutoff
 * comparison, or anything stored in a prediction's
 * result_snapshot. It only controls how many "aspirational"
 * colleges appear at the top of the Recommended Preference
 * Order section (see predictionResult.service.js), which is
 * rebuilt fresh every time a result is displayed.
 */
const DEFAULT_ASPIRATIONAL_COUNT = 5;

/**
 * Per-exam overrides, keyed by exam_types.code (e.g. 'MBA_CET').
 * Empty for now — every exam uses DEFAULT_ASPIRATIONAL_COUNT
 * until a specific exam needs its own value.
 */
const ASPIRATIONAL_COUNT_BY_EXAM_CODE = {};

function getAspirationalCountForExam(examTypeCode) {
  const count = ASPIRATIONAL_COUNT_BY_EXAM_CODE[examTypeCode];
  return typeof count === 'number' ? count : DEFAULT_ASPIRATIONAL_COUNT;
}

module.exports = { getAspirationalCountForExam, DEFAULT_ASPIRATIONAL_COUNT, ASPIRATIONAL_COUNT_BY_EXAM_CODE };
