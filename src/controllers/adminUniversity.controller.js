'use strict';

const adminUniversityService = require('../services/adminUniversity.service');
const { url } = require('../utils/url');

async function list(req, res) {
  const universities = await adminUniversityService.listUniversityExamGroups();
  res.render('admin/universities/list', { title: 'WhatsApp Groups', universities });
}

async function showEditForm(req, res) {
  const context = await adminUniversityService.getEditContext(req.params.universityId, req.params.examTypeId);
  if (!context) {
    return res.status(404).render('pages/error', {
      title: 'Not Found',
      statusCode: 404,
      message: 'We could not find that university or exam type.',
    });
  }
  res.render('admin/universities/form', { title: 'Edit WhatsApp Group', ...context });
}

async function update(req, res) {
  await adminUniversityService.updateWhatsappGroup(req.params.universityId, req.params.examTypeId, req.body);
  res.redirect(url('/admin/universities?success=' + encodeURIComponent('WhatsApp group link was updated successfully.')));
}

module.exports = { list, showEditForm, update };