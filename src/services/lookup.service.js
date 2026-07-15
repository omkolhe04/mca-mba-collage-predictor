'use strict';

const categoryRepository = require('../repositories/category.repository');
const universityRepository = require('../repositories/university.repository');
const collegeRepository = require('../repositories/college.repository');
const examTypeRepository = require('../repositories/examType.repository');
const AppError = require('../utils/AppError');

/**
 * Used as the fallback when no exam is explicitly specified —
 * preserves existing behavior for any caller not yet updated to
 * pass a specific exam (e.g. the CLI import script's default).
 * This will matter less once Phase 11c wires real exam selection
 * through the prediction form end-to-end, but existing MCA-only
 * flows must keep working exactly as before in the meantime.
 */
const DEFAULT_EXAM_TYPE_CODE = 'MCA_CET';

// exam_types is small, static-ish reference data — cached per
// code for the process lifetime rather than re-fetched on every
// call. A Map (not a single variable) because multiple exam
// types are now active simultaneously (MCA CET, MBA CET, ...).
const examTypeCache = new Map();

/**
 * Looks up an exam type by its code (e.g. 'MCA_CET', 'MBA_CET'),
 * cached after the first lookup.
 */
async function getExamTypeByCode(code) {
  if (examTypeCache.has(code)) {
    return examTypeCache.get(code);
  }
  const examType = await examTypeRepository.findByCode(code);
  if (!examType) {
    throw AppError.internal(`Exam type "${code}" not found. Did you run the database seeds?`);
  }
  examTypeCache.set(code, examType);
  return examType;
}

/**
 * The default exam type, used only as a fallback when a caller
 * doesn't specify which exam it means.
 */
async function getDefaultExamType() {
  return getExamTypeByCode(DEFAULT_EXAM_TYPE_CODE);
}

/**
 * Every active exam type — feeds the exam-selection step on the
 * prediction form (Phase 11c) and any admin exam-type selector.
 */
async function getAllActiveExamTypes() {
  return examTypeRepository.findAllActive();
}

/**
 * Resolves "which exam is currently selected" for any admin
 * screen with an exam-type selector (Manage Colleges, Dashboard,
 * Import Data) — defaults to MCA CET if no code is given (e.g.
 * first visit to the page, no ?exam= query param yet), and
 * always returns the full active list too, for rendering the
 * selector itself.
 */
async function resolveExamTypeSelection(examTypeCode) {
  const [examType, allExamTypes] = await Promise.all([
    examTypeCode ? getExamTypeByCode(examTypeCode) : getDefaultExamType(),
    getAllActiveExamTypes(),
  ]);
  return { examType, allExamTypes };
}

/**
 * Everything the prediction form's dropdowns need for a given
 * exam, in one call. Colleges will be an empty array until real
 * CAP data has been imported for that exam — expected, not an
 * error.
 *
 * @param {string} [examTypeCode] - defaults to MCA_CET if omitted,
 *   preserving existing behavior for not-yet-updated callers.
 */
async function getFormOptions(examTypeCode = DEFAULT_EXAM_TYPE_CODE) {
  const examType = await getExamTypeByCode(examTypeCode);

  const [categories, universities, colleges] = await Promise.all([
    categoryRepository.findAllBaseCategories(),
    universityRepository.findAllActive(),
    collegeRepository.findAllActiveByExamType(examType.id),
  ]);

  return { examType, categories, universities, colleges };
}

module.exports = {
  DEFAULT_EXAM_TYPE_CODE,
  getExamTypeByCode,
  getDefaultExamType,
  getAllActiveExamTypes,
  resolveExamTypeSelection,
  getFormOptions,
};
