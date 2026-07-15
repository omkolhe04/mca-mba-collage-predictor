'use strict';

const adminExamTypeService = require('../services/adminExamType.service');
const { url } = require('../utils/url');

async function list(req, res) {
  const examTypes = await adminExamTypeService.listExamTypes();
  res.render('admin/exam-types/list', { title: 'Manage Exam Types', examTypes });
}

async function showCreateForm(req, res) {
  res.render('admin/exam-types/form', { title: 'Add Exam Type', mode: 'create', examType: {} });
}

async function create(req, res) {
  const examType = await adminExamTypeService.createExamType(req.body);
  res.redirect(url(`/admin/exam-types?success=${encodeURIComponent(`"${examType.name}" was added successfully.`)}`));
}

async function showEditForm(req, res) {
  const examType = await adminExamTypeService.getExamTypeForEdit(req.params.id);
  if (!examType) {
    return res.status(404).render('pages/error', {
      title: 'Not Found',
      statusCode: 404,
      message: 'We could not find that exam type.',
    });
  }
  res.render('admin/exam-types/form', { title: 'Edit Exam Type', mode: 'edit', examType });
}

async function update(req, res) {
  const examType = await adminExamTypeService.updateExamType(req.params.id, req.body);
  res.redirect(url(`/admin/exam-types?success=${encodeURIComponent(`"${examType.name}" was updated successfully.`)}`));
}

module.exports = { list, showCreateForm, create, showEditForm, update };
