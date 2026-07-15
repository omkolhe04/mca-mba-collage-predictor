'use strict';

const adminUniversityService = require('../services/adminUniversity.service');
const universityRepository = require('../repositories/university.repository');
const { url } = require('../utils/url');

async function list(req, res) {
  const universities = await adminUniversityService.listUniversities();
  res.render('admin/universities/list', { title: 'WhatsApp Groups', universities });
}

async function showEditForm(req, res) {
  const university = await universityRepository.findById(req.params.id);
  if (!university) {
    return res.status(404).render('pages/error', {
      title: 'Not Found',
      statusCode: 404,
      message: 'We could not find that university.',
    });
  }
  res.render('admin/universities/form', { title: 'Edit WhatsApp Group', university });
}

async function update(req, res) {
  const university = await adminUniversityService.updateWhatsappGroup(req.params.id, req.body);
  res.redirect(url(`/admin/universities?success=${encodeURIComponent(`"${university.name}" was updated successfully.`)}`));
}

module.exports = { list, showEditForm, update };
