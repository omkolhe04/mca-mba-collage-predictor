'use strict';

const universityRepository = require('../repositories/university.repository');
const examTypeRepository = require('../repositories/examType.repository');
const universityExamWhatsappGroupRepository = require('../repositories/universityExamWhatsappGroup.repository');
const AppError = require('../utils/AppError');

/**
 * Builds the full admin grid: every university, crossed with
 * every active exam type, with that combination's WhatsApp link
 * attached if one has been set - so the admin screen shows every
 * possible combination (including ones never configured yet),
 * not just the ones that already have a row in the database.
 */
async function listUniversityExamGroups() {
  const [universities, examTypes, existingLinks] = await Promise.all([
    universityRepository.findAll(),
    examTypeRepository.findAllActive(),
    universityExamWhatsappGroupRepository.findAll(),
  ]);

  const linkByKey = new Map(existingLinks.map((link) => [`${link.university_id}|${link.exam_type_id}`, link]));

  return universities.map((university) => ({
    ...university,
    exams: examTypes.map((examType) => {
      const existing = linkByKey.get(`${university.id}|${examType.id}`);
      return {
        examTypeId: examType.id,
        examTypeCode: examType.code,
        examTypeName: examType.name,
        whatsappGroupLink: existing ? existing.whatsapp_group_link : null,
      };
    }),
  }));
}

async function getEditContext(universityId, examTypeId) {
  const [university, examType, existing] = await Promise.all([
    universityRepository.findById(universityId),
    examTypeRepository.findById(examTypeId),
    universityExamWhatsappGroupRepository.findByUniversityAndExam(universityId, examTypeId),
  ]);

  if (!university || !examType) {
    return null;
  }

  return { university, examType, whatsappGroupLink: existing ? existing.whatsapp_group_link : '' };
}

async function updateWhatsappGroup(universityId, examTypeId, formData) {
  const link = (formData.whatsappGroupLink || '').trim();
  if (link && !/^https?:\/\/.+/i.test(link)) {
    throw AppError.badRequest('WhatsApp group link must be a valid URL starting with http:// or https://');
  }

  return universityExamWhatsappGroupRepository.upsert(universityId, examTypeId, link || null);
}

module.exports = { listUniversityExamGroups, getEditContext, updateWhatsappGroup };