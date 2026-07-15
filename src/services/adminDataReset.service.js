'use strict';

const collegeRepository = require('../repositories/college.repository');
const importBatchRepository = require('../repositories/importBatch.repository');
const lookupService = require('./lookup.service');
const AppError = require('../utils/AppError');

const REQUIRED_CONFIRMATION_TEXT = 'DELETE ALL DATA';

/**
 * Stats shown on the confirmation screen before an admin commits
 * to the reset — so "how much am I about to delete" is answered
 * before, not after. Scoped to whichever exam is currently
 * selected (defaults to MCA CET) — resetting is per-exam, never
 * "reset everything across every exam" in one action.
 */
async function getResetPreview(examTypeCode) {
  const { examType, allExamTypes } = await lookupService.resolveExamTypeSelection(examTypeCode);
  const collegeCount = await collegeRepository.countAll(examType.id);
  return {
    examType,
    allExamTypes,
    examTypeName: examType.name,
    collegeCount,
    requiredConfirmationText: REQUIRED_CONFIRMATION_TEXT,
  };
}

/**
 * Wipes every college for ONE specific exam type — branches,
 * cutoffs, placements, and fees cascade automatically (see
 * migrations 008-011), and import batch history for that exam
 * type is cleared too. Users and their prediction records are
 * NEVER touched by this — a prediction's already-computed
 * result_snapshot keeps displaying correctly (it stored college
 * names/cutoffs at prediction time), even after the live college
 * rows are gone; only its dream_college_id reference goes null
 * (see migration 021).
 *
 * Requires an exact confirmation phrase, checked server-side —
 * this is deliberately not something a single accidental click
 * can trigger. `examTypeCode` is required explicitly (passed as
 * a hidden field on the confirmation form) rather than inferred
 * from "whatever's currently selected" server-side state, so
 * there's no ambiguity about which exam's data is being deleted.
 */
async function resetExamData(confirmationText, examTypeCode) {
  if (confirmationText !== REQUIRED_CONFIRMATION_TEXT) {
    throw AppError.badRequest(`Confirmation text did not match. Type exactly: "${REQUIRED_CONFIRMATION_TEXT}"`);
  }
  if (!examTypeCode) {
    throw AppError.badRequest('No exam type specified for reset.');
  }

  const examType = await lookupService.getExamTypeByCode(examTypeCode);

  const batchesDeleted = await importBatchRepository.deleteAllByExamType(examType.id);
  const collegesDeleted = await collegeRepository.deleteAllByExamType(examType.id);

  return { collegesDeleted, batchesDeleted };
}

module.exports = { getResetPreview, resetExamData };
