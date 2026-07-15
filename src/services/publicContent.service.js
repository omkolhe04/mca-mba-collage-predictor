'use strict';

const notificationRepository = require('../repositories/notification.repository');
const sliderRepository = require('../repositories/slider.repository');
const { getPublicImageUrl } = require('../utils/supabaseStorage');

async function getActiveNotifications() {
  return notificationRepository.findActiveNow();
}

async function getActiveSliders() {
  const sliders = await sliderRepository.findActiveOrdered();
  return sliders.map((s) => ({ ...s, publicUrl: getPublicImageUrl(s.image_path) }));
}

module.exports = { getActiveNotifications, getActiveSliders };
