'use strict';

const lookupService = require('../services/lookup.service');
const collegeRepository = require('../repositories/college.repository');
const AppError = require('../utils/AppError');

/**
 * GET /api/colleges?exam=MCA_CET
 *
 * Returns the active colleges for one exam type, as JSON. Used
 * by the prediction form's client-side JS to repopulate the
 * Dream College dropdown when the student switches which exam
 * they're predicting for, without a full page reload or losing
 * whatever they've already typed in Section 1.
 */
async function getColleges(req, res) {
  const examTypeCode = req.query.exam;
  if (!examTypeCode) {
    throw AppError.badRequest('Missing required "exam" query parameter.');
  }

  const examType = await lookupService.getExamTypeByCode(examTypeCode);
  const colleges = await collegeRepository.findAllActiveByExamType(examType.id);

  res.json({
    examTypeCode,
    colleges: colleges.map((c) => ({ id: c.id, name: c.name, city: c.city })),
  });
}

module.exports = { getColleges };
