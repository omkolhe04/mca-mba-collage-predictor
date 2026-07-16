'use strict';

const userRepository = require('../repositories/user.repository');
const predictionRepository = require('../repositories/prediction.repository');
const adminUserRepository = require('../repositories/adminUser.repository');
const examTypeRepository = require('../repositories/examType.repository');
const universityRepository = require('../repositories/university.repository');
const categoryRepository = require('../repositories/category.repository');
const { url } = require('../utils/url');

function readFilters(req) {
  return {
    search: req.query.search || '',
    examTypeId: req.query.examTypeId || '',
    admissionUniversityId: req.query.universityId || '',
    categoryId: req.query.categoryId || '',
    gender: req.query.gender || '',
    dateFrom: req.query.dateFrom || '',
    dateTo: req.query.dateTo || '',
    sort: req.query.sort || 'newest',
  };
}

async function getFilterLookups() {
  const [examTypes, universities, categories] = await Promise.all([
    examTypeRepository.findAllActive(),
    universityRepository.findAllActive(),
    categoryRepository.findAll(),
  ]);
  return { examTypes, universities, categories };
}

async function list(req, res) {
  const filters = readFilters(req);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = [25, 50, 100].includes(parseInt(req.query.pageSize, 10)) ? parseInt(req.query.pageSize, 10) : 25;

  const [{ rows, total }, lookups] = await Promise.all([
    adminUserRepository.findFiltered({ ...filters, page, pageSize }),
    getFilterLookups(),
  ]);

  res.render('admin/users/list', {
    title: 'Manage Users',
    users: rows,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    filters,
    ...lookups,
  });
}

/**
 * Returns an HTML fragment (no layout) for the "View Details"
 * side drawer, fetched client-side via a small JS fetch() call
 * when an admin clicks "View" — keeping the main list request
 * light rather than embedding every row's full prediction detail
 * (including its potentially large result_snapshot) up front.
 */
async function detailPartial(req, res) {
  const detail = await adminUserRepository.findDetailByPredictionId(req.params.predictionId);
  if (!detail) {
    return res.status(404).send('<p class="text-center small">Could not find that prediction.</p>');
  }
  res.render('admin/users/detail-partial', { layout: false, detail });
}

/**
 * CSV export, respecting whichever filters are currently active
 * on the list page - not a dump of every user regardless of what
 * the admin was actually looking at.
 */
async function exportCsv(req, res) {
  const filters = readFilters(req);
  const { rows } = await adminUserRepository.findFiltered({ ...filters, page: 1, pageSize: 10000 });

  const header = ['Name', 'Mobile', 'Email', 'Gender', 'Category', 'Entrance Exam', 'Admission University', 'Percentile', 'Prediction Date'];
  const escapeCsv = (value) => `"${String(value == null ? '' : value).replace(/"/g, '""')}"`;
  const lines = [header.map(escapeCsv).join(',')];
  for (const row of rows) {
    lines.push(
      [
        row.name,
        row.mobile,
        row.email,
        row.gender || '',
        row.categoryName,
        row.examTypeName,
        row.admissionUniversityName,
        row.percentile,
        new Date(row.createdAt).toLocaleDateString('en-IN'),
      ]
        .map(escapeCsv)
        .join(',')
    );
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="users-export.csv"');
  res.send(lines.join('\n'));
}

async function detail(req, res) {
  const user = await userRepository.findById(req.params.id);

  if (!user) {
    return res.status(404).render('pages/error', {
      title: 'Not Found',
      statusCode: 404,
      message: 'We could not find that user.',
    });
  }

  const predictions = await predictionRepository.findByUserId(user.id);

  res.render('admin/users/detail', { title: user.name, user, predictions });
}

async function toggleActive(req, res) {
  const user = await userRepository.findById(req.params.id);
  if (!user) {
    return res.status(404).render('pages/error', {
      title: 'Not Found',
      statusCode: 404,
      message: 'We could not find that user.',
    });
  }

  await userRepository.updateActiveStatus(user.id, !user.is_active);
  res.redirect(url(`/admin/users/${user.id}`));
}

module.exports = { list, detailPartial, exportCsv, detail, toggleActive };