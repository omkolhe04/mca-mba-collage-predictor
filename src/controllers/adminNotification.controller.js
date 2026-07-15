'use strict';

const adminNotificationService = require('../services/adminNotification.service');
const { url } = require('../utils/url');

async function list(req, res) {
  const page = parseInt(req.query.page, 10) || 1;
  const result = await adminNotificationService.listNotifications({ page });
  res.render('admin/notifications/list', { title: 'Manage Notifications', ...result });
}

async function showCreateForm(req, res) {
  res.render('admin/notifications/form', { title: 'Add Notification', mode: 'create', notification: {} });
}

async function create(req, res) {
  await adminNotificationService.createNotification(req.body);
  res.redirect(url('/admin/notifications'));
}

async function showEditForm(req, res) {
  const notification = await adminNotificationService.getForEdit(req.params.id);
  if (!notification) {
    return res.status(404).render('pages/error', {
      title: 'Not Found',
      statusCode: 404,
      message: 'We could not find that notification.',
    });
  }
  res.render('admin/notifications/form', { title: 'Edit Notification', mode: 'edit', notification });
}

async function update(req, res) {
  await adminNotificationService.updateNotification(req.params.id, req.body);
  res.redirect(url('/admin/notifications'));
}

module.exports = { list, showCreateForm, create, showEditForm, update };
