'use strict';

const { v4: uuidv4 } = require('uuid');
const sliderRepository = require('../repositories/slider.repository');
const { uploadImage, getPublicImageUrl } = require('../utils/supabaseStorage');
const AppError = require('../utils/AppError');

async function listSliders() {
  const sliders = await sliderRepository.findAllOrdered();
  return sliders.map((s) => ({ ...s, publicUrl: getPublicImageUrl(s.image_path) }));
}

async function getForEdit(id) {
  const slider = await sliderRepository.findById(id);
  if (!slider) return null;
  return { ...slider, publicUrl: getPublicImageUrl(slider.image_path) };
}

function extensionFor(mimeType) {
  const map = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
  return map[mimeType] || 'jpg';
}

async function createSlider(formData, file) {
  if (!file) {
    throw AppError.badRequest('Please choose an image to upload.');
  }
  const path = `sliders/${uuidv4()}.${extensionFor(file.mimetype)}`;
  await uploadImage(path, file.buffer, file.mimetype);

  return sliderRepository.create({
    title: formData.title || null,
    image_path: path,
    link_url: formData.linkUrl || null,
    display_order: formData.displayOrder ? parseInt(formData.displayOrder, 10) : 0,
    is_active: formData.isActive === 'on',
  });
}

async function updateSlider(id, formData, file) {
  const updates = {
    title: formData.title || null,
    link_url: formData.linkUrl || null,
    display_order: formData.displayOrder ? parseInt(formData.displayOrder, 10) : 0,
    is_active: formData.isActive === 'on',
  };

  // A new image is optional on edit — only replace it if one was uploaded.
  if (file) {
    const path = `sliders/${uuidv4()}.${extensionFor(file.mimetype)}`;
    await uploadImage(path, file.buffer, file.mimetype);
    updates.image_path = path;
  }

  return sliderRepository.update(id, updates);
}

module.exports = { listSliders, getForEdit, createSlider, updateSlider };
