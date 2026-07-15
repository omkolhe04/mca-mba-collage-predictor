'use strict';

const notificationRepository = require('../repositories/notification.repository');

async function listNotifications({ page }) {
  const pageSize = 20;
  const { rows, total } = await notificationRepository.findAllPaginated({ page, pageSize });
  return { notifications: rows, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

async function getForEdit(id) {
  return notificationRepository.findById(id);
}

function mapFormData(formData) {
  return {
    title: formData.title,
    message: formData.message,
    type: formData.type || 'info',
    starts_at: formData.startsAt || null,
    ends_at: formData.endsAt || null,
    is_active: formData.isActive === 'on',
  };
}

async function createNotification(formData) {
  return notificationRepository.create(mapFormData(formData));
}

async function updateNotification(id, formData) {
  return notificationRepository.update(id, mapFormData(formData));
}

module.exports = { listNotifications, getForEdit, createNotification, updateNotification };
