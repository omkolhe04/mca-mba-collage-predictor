'use strict';

const examTypeRepository = require('../repositories/examType.repository');
const AppError = require('../utils/AppError');

async function listExamTypes() {
  return examTypeRepository.findAll();
}

async function getExamTypeForEdit(id) {
  return examTypeRepository.findById(id);
}

/**
 * `code` (e.g. 'MCA_CET') is deliberately never editable once
 * created — it's referenced as a default fallback by the CLI
 * import script and several admin services, and changing it on
 * an existing row could silently orphan those references. Only
 * name, cap_rounds, and is_active can be updated.
 */
async function updateExamType(id, formData) {
  const capRounds = parseInt(formData.capRounds, 10);
  if (!formData.name || !formData.name.trim()) {
    throw AppError.badRequest('Exam name is required');
  }
  if (Number.isNaN(capRounds) || capRounds < 1 || capRounds > 10) {
    throw AppError.badRequest('CAP rounds must be a number between 1 and 10');
  }

  return examTypeRepository.update(id, {
    name: formData.name.trim(),
    cap_rounds: capRounds,
    is_active: formData.isActive === 'on',
  });
}

/**
 * Creates a brand-new exam type — this is the "Future Ready"
 * extension point: adding Engineering, Pharmacy, Nursing, etc.
 * later needs only a new row here (plus data import + a
 * prediction form entry), no code changes.
 */
async function createExamType(formData) {
  const code = (formData.code || '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  const capRounds = parseInt(formData.capRounds, 10);

  if (!code) {
    throw AppError.badRequest('Exam code is required');
  }
  if (!formData.name || !formData.name.trim()) {
    throw AppError.badRequest('Exam name is required');
  }
  if (Number.isNaN(capRounds) || capRounds < 1 || capRounds > 10) {
    throw AppError.badRequest('CAP rounds must be a number between 1 and 10');
  }

  const existing = await examTypeRepository.findByCode(code);
  if (existing) {
    throw AppError.badRequest(`An exam type with code "${code}" already exists.`);
  }

  return examTypeRepository.create({
    code,
    name: formData.name.trim(),
    cap_rounds: capRounds,
    is_active: formData.isActive === 'on',
  });
}

module.exports = { listExamTypes, getExamTypeForEdit, updateExamType, createExamType };
