'use strict';

const adminCollegeService = require('../services/adminCollege.service');
const examTypeRepository = require('../repositories/examType.repository');
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
  res.redirect(url(`/admin/colleges?exam=${encodeURIComponent(req.body.examTypeCode)}`));
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
    // Carried through as hidden form fields so "Save Changes"
    // can return to the exact page/search/exam the admin was on
    // - editing a college on page 18 of a filtered list should
    // land back on page 18, not silently reset to page 1.
    returnPage: req.query.returnPage || '1',
    returnSearch: req.query.returnSearch || '',
    returnExam: req.query.returnExam || '',
    ...extras,
  });
}

async function update(req, res) {
  const updatedCollege = await adminCollegeService.updateCollege(req.params.id, req.body);
  const examType = await examTypeRepository.findById(updatedCollege.exam_type_id);
  const examCode = req.body.returnExam || (examType ? examType.code : '');

  const params = new URLSearchParams();
  if (examCode) params.set('exam', examCode);
  if (req.body.returnPage) params.set('page', req.body.returnPage);
  if (req.body.returnSearch) params.set('search', req.body.returnSearch);

  const query = params.toString();
  res.redirect(url(`/admin/colleges${query ? '?' + query : ''}`));
}

function buildReturnQuery(body) {
  const params = new URLSearchParams();
  if (body.returnPage) params.set('returnPage', body.returnPage);
  if (body.returnSearch) params.set('returnSearch', body.returnSearch);
  if (body.returnExam) params.set('returnExam', body.returnExam);
  const query = params.toString();
  return query ? `?${query}` : '';
}

async function addPlacement(req, res) {
  await adminCollegeService.addOrUpdatePlacement(req.params.id, req.body);
  res.redirect(url(`/admin/colleges/${req.params.id}/edit${buildReturnQuery(req.body)}`));
}

async function addFee(req, res) {
  await adminCollegeService.addOrUpdateFee(req.params.id, req.body);
  res.redirect(url(`/admin/colleges/${req.params.id}/edit${buildReturnQuery(req.body)}`));
}

module.exports = { list, showCreateForm, create, showEditForm, update, addPlacement, addFee };
