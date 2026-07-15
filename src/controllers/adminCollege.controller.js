'use strict';

const adminCollegeService = require('../services/adminCollege.service');
const { url } = require('../utils/url');

async function list(req, res) {
  const search = req.query.search || '';
  const page = parseInt(req.query.page, 10) || 1;
  const examTypeCode = req.query.exam || null;
  const result = await adminCollegeService.listColleges({ search, page, examTypeCode });
  res.render('admin/colleges/list', { title: 'Manage Colleges', ...result, search });
}

async function showCreateForm(req, res) {
  const { universities, examTypes } = await adminCollegeService.getFormLookups();
  res.render('admin/colleges/form', {
    title: 'Add College',
    mode: 'create',
    universities,
    examTypes,
    college: {},
    errors: {},
  });
}

async function create(req, res) {
  await adminCollegeService.createCollege(req.body);
  res.redirect(url('/admin/colleges'));
}

async function showEditForm(req, res) {
  const [college, lookups, extras] = await Promise.all([
    adminCollegeService.getCollegeForEdit(req.params.id),
    adminCollegeService.getFormLookups(),
    adminCollegeService.getPlacementsAndFees(req.params.id),
  ]);

  if (!college) {
    return res.status(404).render('pages/error', {
      title: 'Not Found',
      statusCode: 404,
      message: 'We could not find that college.',
    });
  }

  res.render('admin/colleges/form', {
    title: 'Edit College',
    mode: 'edit',
    universities: lookups.universities,
    college,
    errors: {},
    ...extras,
  });
}

async function update(req, res) {
  await adminCollegeService.updateCollege(req.params.id, req.body);
  res.redirect(url(`/admin/colleges/${req.params.id}/edit`));
}

async function addPlacement(req, res) {
  await adminCollegeService.addOrUpdatePlacement(req.params.id, req.body);
  res.redirect(url(`/admin/colleges/${req.params.id}/edit`));
}

async function addFee(req, res) {
  await adminCollegeService.addOrUpdateFee(req.params.id, req.body);
  res.redirect(url(`/admin/colleges/${req.params.id}/edit`));
}

module.exports = { list, showCreateForm, create, showEditForm, update, addPlacement, addFee };
