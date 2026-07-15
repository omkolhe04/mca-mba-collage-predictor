'use strict';

const { importCutoffData } = require('../services/import/cutoffImport.service');
const adminImportHistoryService = require('../services/adminImportHistory.service');
const adminDataResetService = require('../services/adminDataReset.service');
const AppError = require('../utils/AppError');
const { url } = require('../utils/url');

async function showForm(req, res) {
  const examTypeCode = req.query.exam || null;

  const [{ history, examType, allExamTypes }, resetPreview] = await Promise.all([
    adminImportHistoryService.listImportHistory(examTypeCode),
    adminDataResetService.getResetPreview(examTypeCode),
  ]);

  res.render('admin/import', {
    title: 'Import Cutoff Data',
    report: null,
    history,
    examType,
    allExamTypes,
    resetPreview,
  });
}

/**
 * Thin web wrapper around the exact same import engine the CLI
 * script (scripts/import-cutoffs.js) uses — same service,
 * same validation, same duplicate-prevention. Only the input
 * source (uploaded file vs. filesystem path) differs. Which exam
 * this file's data belongs to is an explicit dropdown on the
 * upload form itself (req.body.examTypeCode), not inferred from
 * whichever exam tab happened to be selected when the page
 * loaded — uploading is a deliberate per-file choice.
 */
async function handleUpload(req, res) {
  if (!req.file) {
    throw AppError.badRequest('Please choose a JSON file to upload.');
  }

  let rows;
  try {
    rows = JSON.parse(req.file.buffer.toString('utf8'));
  } catch (err) {
    throw AppError.badRequest(`Uploaded file is not valid JSON: ${err.message}`);
  }

  const examTypeCode = req.body.examTypeCode || 'MCA_CET';
  const report = await importCutoffData(examTypeCode, rows, {
    filename: req.file.originalname,
    importedByAdminId: req.admin.adminId,
  });

  const [{ history, examType, allExamTypes }, resetPreview] = await Promise.all([
    adminImportHistoryService.listImportHistory(examTypeCode),
    adminDataResetService.getResetPreview(examTypeCode),
  ]);

  res.render('admin/import', {
    title: 'Import Cutoff Data',
    report,
    history,
    examType,
    allExamTypes,
    resetPreview,
  });
}

/**
 * Deletes an import batch's cutoff data. Colleges/branches it
 * created are left in place — see adminImportHistory.service.js.
 */
async function deleteBatch(req, res) {
  await adminImportHistoryService.deleteImportBatch(req.params.id);
  res.redirect(url('/admin/import'));
}

/**
 * Danger-zone action: wipes ALL college/branch/cutoff/import
 * data for ONE specific exam type (explicitly named via a hidden
 * form field, not inferred from server-side state). Requires an
 * exact typed confirmation phrase, checked server-side.
 */
async function resetData(req, res) {
  const { examTypeCode } = req.body;
  await adminDataResetService.resetExamData(req.body.confirmText, examTypeCode);
  res.redirect(url(`/admin/import?exam=${examTypeCode}`));
}

module.exports = { showForm, handleUpload, deleteBatch, resetData };
