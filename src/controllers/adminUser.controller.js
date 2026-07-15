'use strict';

const userRepository = require('../repositories/user.repository');
const predictionRepository = require('../repositories/prediction.repository');
const { url } = require('../utils/url');

async function list(req, res) {
  const search = req.query.search || '';
  const page = parseInt(req.query.page, 10) || 1;
  const pageSize = 20;

  const { rows, total } = await userRepository.findAllPaginated({ search, page, pageSize });

  res.render('admin/users/list', {
    title: 'Manage Users',
    users: rows,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    search,
  });
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

module.exports = { list, detail, toggleActive };
