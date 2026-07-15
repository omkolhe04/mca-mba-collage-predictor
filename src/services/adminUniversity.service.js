'use strict';

const universityRepository = require('../repositories/university.repository');
const AppError = require('../utils/AppError');

async function listUniversities() {
  return universityRepository.findAll();
}

/**
 * Updates a university's short name and/or WhatsApp group link.
 * Both are optional/nullable — an admin can clear a link entirely
 * by leaving the field blank, which makes the result page's join
 * button correctly disappear for that university again.
 */
async function updateWhatsappGroup(id, formData) {
  const link = (formData.whatsappGroupLink || '').trim();
  if (link && !/^https?:\/\/.+/i.test(link)) {
    throw AppError.badRequest('WhatsApp group link must be a valid URL starting with http:// or https://');
  }

  return universityRepository.update(id, {
    short_name: (formData.shortName || '').trim() || null,
    whatsapp_group_link: link || null,
  });
}

module.exports = { listUniversities, updateWhatsappGroup };
