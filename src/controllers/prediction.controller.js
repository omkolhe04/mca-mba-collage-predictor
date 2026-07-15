'use strict';

const lookupService = require('../services/lookup.service');
const predictionService = require('../services/prediction.service');
const predictionResultService = require('../services/predictionResult.service');
const pdfReportService = require('../services/pdfReport.service');
const userService = require('../services/user.service');
const examTypeRepository = require('../repositories/examType.repository');
const collegeRepository = require('../repositories/college.repository');
const { setUserSessionCookie } = require('../utils/userSession');
const { generateRoundCodes, CHANCE_BUCKET_META } = require('../utils/constants');
const { url } = require('../utils/url');

/**
 * GET /predict — the "Start Prediction" entry point. A returning
 * user with an existing prediction is sent straight to their
 * result rather than shown a blank form (per the returning-user
 * experience) — UNLESS ?new=true is present, which is what the
 * "✨ New Prediction" button links to instead, and always shows
 * the form, pre-filled from their latest prediction.
 *
 * A user row only ever exists because of a prior prediction
 * submission (see prediction.service.js) — there's no other path
 * that creates one — so "has a user" and "has a latest
 * prediction" are effectively the same condition here, and the
 * prediction row (not the user row) is the single source of
 * truth for pre-fill, since it holds fields (exam, dream college,
 * reservations) the user row never did.
 */
async function showForm(req, res) {
  const latestPrediction = res.locals.latestPrediction;
  const wantsNewPrediction = req.query.new === 'true';

  if (latestPrediction && !wantsNewPrediction) {
    return res.redirect(url(`/predict/${latestPrediction.id}/result`));
  }

  const examTypes = await lookupService.getAllActiveExamTypes();

  // Pre-fill from the latest prediction's own exam, not always
  // the default — a returning MBA CET user reopening "New
  // Prediction" should see MBA CET pre-selected, with its own
  // college list, not MCA CET's.
  let selectedExamCode = lookupService.DEFAULT_EXAM_TYPE_CODE;
  if (latestPrediction) {
    const examType = await examTypeRepository.findById(latestPrediction.exam_type_id);
    if (examType) {
      selectedExamCode = examType.code;
    }
  }

  const formOptions = await lookupService.getFormOptions(selectedExamCode);

  // Real college counts per exam, for the exam-selection cards'
  // stat pills — shown instead of the spec's illustrative "250+"
  // style placeholder numbers, since this is a functional part of
  // the form a student is about to act on (not top-of-funnel
  // marketing), so accuracy matters more than a rounder number.
  const examTypesWithCounts = await Promise.all(
    examTypes.map(async (examType) => ({
      ...examType,
      collegeCount: await collegeRepository.countAll(examType.id),
    }))
  );

  // The prediction row holds exam/category/reservation fields;
  // name/mobile/email live on the user row instead, so both are
  // fetched together when pre-filling from an existing prediction.
  let formValues = {};
  if (latestPrediction) {
    const user = await userService.findUserById(latestPrediction.user_id);
    formValues = {
      name: user?.name,
      mobile: user?.mobile,
      email: user?.email,
      gender: latestPrediction.gender,
      percentile: latestPrediction.percentile,
      categoryId: latestPrediction.category_id,
      homeUniversityId: latestPrediction.home_university_id,
      admissionUniversityId: latestPrediction.admission_university_id,
      dreamCollegeId: latestPrediction.dream_college_id,
      isTfws: latestPrediction.is_tfws,
      isEws: latestPrediction.is_ews,
      isMinority: latestPrediction.is_minority,
      isDefence: latestPrediction.is_defence,
      isPwd: latestPrediction.is_pwd,
    };
  }

  res.render('pages/predict', {
    title: 'Start Your Prediction',
    examTypes: examTypesWithCounts,
    selectedExamCode,
    ...formOptions,
    formValues,
    errors: {},
  });
}

/**
 * POST /predict — reached only after validateRequest middleware
 * confirms the input is clean. Creates/updates the user, sets
 * the invisible session cookie, stores the prediction inputs,
 * runs the Prediction Engine, and redirects to the result page.
 */
async function submitForm(req, res) {
  // Set by the mobile validator when this exact number already
  // has a prediction with the exact same percentile resubmitted
  // — not an error, just show them what already exists rather
  // than creating or touching anything.
  if (req.existingPredictionForMobile) {
    return res.redirect(url(`/predict/${req.existingPredictionForMobile.id}/result`));
  }

  const formData = {
    examTypeCode: req.body.examTypeCode,
    name: req.body.name.trim(),
    mobile: req.body.mobile.trim(),
    email: req.body.email.trim().toLowerCase(),
    percentile: parseFloat(req.body.percentile),
    gender: req.body.gender,
    categoryId: req.body.categoryId,
    homeUniversityId: req.body.homeUniversityId,
    admissionUniversityId: req.body.admissionUniversityId,
    dreamCollegeId: req.body.dreamCollegeId || null,
    isTfws: req.body.isTfws === 'on',
    isEws: req.body.isEws === 'on',
    isMinority: req.body.isMinority === 'on',
    isDefence: req.body.isDefence === 'on',
    isPwd: req.body.isPwd === 'on',
  };

  const { user, prediction } = await predictionService.submitPrediction(formData);

  setUserSessionCookie(res, user.id);

  res.redirect(url(`/predict/${prediction.id}/result`));
}

/**
 * GET /predict/:id/result — the real result page. Renders the
 * Prediction Engine's per-round chance breakdown, the dream
 * college card, and the recommended CAP preference order, all
 * enriched with fee/placement/NAAC display data.
 */
async function showResult(req, res) {
  const resultView = await predictionResultService.buildResultView(req.params.id);

  if (!resultView) {
    return res.status(404).render('pages/error', {
      title: 'Not Found',
      statusCode: 404,
      message: 'We could not find that prediction.',
    });
  }

  // Round codes come from the snapshot itself (set by the engine
  // at computation time — could be 4 rounds for MCA CET, 3 for
  // MBA CET, etc.), not a hardcoded constant. Predictions computed
  // before this existed fall back to 4, matching what the engine
  // always produced at the time.
  const roundCodes = resultView.snapshot?.roundCodes || generateRoundCodes(4);

  const examType = await examTypeRepository.findById(resultView.prediction.exam_type_id);
  const examName = examType ? examType.name : 'MCA CET';

  res.render('pages/result', {
    title: 'Your Prediction Result',
    prediction: resultView.prediction,
    snapshot: resultView.snapshot,
    collegeDetails: resultView.collegeDetails,
    CAP_ROUNDS: roundCodes,
    CHANCE_BUCKET_META,
    examName,
  });
}

/**
 * GET /predict/:id/pdf — streams a freshly generated PDF report
 * for this prediction. Generated on-demand every time, no
 * caching/storage, per product decision.
 */
async function downloadPdf(req, res) {
  const buffer = await pdfReportService.generateReportBuffer(req.params.id);

  if (!buffer) {
    return res.status(404).render('pages/error', {
      title: 'Not Found',
      statusCode: 404,
      message: 'We could not find that prediction.',
    });
  }

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="MCA-MBA-College-Predictor-Report.pdf"`,
    'Content-Length': buffer.length,
  });
  res.send(buffer);
}

module.exports = { showForm, submitForm, showResult, downloadPdf };
