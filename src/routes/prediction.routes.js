'use strict';

const express = require('express');
const router = express.Router();

const asyncHandler = require('../utils/asyncHandler');
const validateRequest = require('../middlewares/validateRequest');
const { predictionFormValidators } = require('../validators/prediction.validator');
const predictionController = require('../controllers/prediction.controller');
const lookupService = require('../services/lookup.service');
const collegeRepository = require('../repositories/college.repository');

// Rebuilds the dropdown data needed to re-render the form if
// validation fails — the form view always needs this, whether
// it's a first GET or a failed POST. Uses whichever exam the
// student actually selected (req.body.examTypeCode), not always
// the default, so a validation error doesn't silently swap them
// back to MCA CET's college list after they picked MBA CET.
async function buildFormLocals(req) {
  const examTypes = await lookupService.getAllActiveExamTypes();
  const validCodes = new Set(examTypes.map((e) => e.code));
  const submittedCode = req.body.examTypeCode;
  // If the submitted exam code is missing or doesn't match a
  // real active exam (e.g. a tampered/garbage form submission),
  // fall back to the default rather than letting an invalid
  // value crash this recovery path — the examTypeCode field
  // itself will still show its own validation error either way.
  const selectedExamCode = validCodes.has(submittedCode) ? submittedCode : lookupService.DEFAULT_EXAM_TYPE_CODE;
  const formOptions = await lookupService.getFormOptions(selectedExamCode);

  const examTypesWithCounts = await Promise.all(
    examTypes.map(async (examType) => ({
      ...examType,
      collegeCount: await collegeRepository.countAll(examType.id),
    }))
  );

  return { ...formOptions, examTypes: examTypesWithCounts, selectedExamCode, title: 'Start Your Prediction' };
}

router.get('/', asyncHandler(predictionController.showForm));

router.post(
  '/',
  predictionFormValidators,
  validateRequest('pages/predict', buildFormLocals),
  asyncHandler(predictionController.submitForm)
);

router.get('/:id/result', asyncHandler(predictionController.showResult));
router.get('/:id/pdf', asyncHandler(predictionController.downloadPdf));

module.exports = router;
