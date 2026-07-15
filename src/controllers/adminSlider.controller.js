'use strict';

const adminSliderService = require('../services/adminSlider.service');
const { url } = require('../utils/url');

async function list(req, res) {
  const sliders = await adminSliderService.listSliders();
  res.render('admin/sliders/list', { title: 'Manage Slider', sliders });
}

async function showCreateForm(req, res) {
  res.render('admin/sliders/form', { title: 'Add Slide', mode: 'create', slider: {} });
}

async function create(req, res) {
  await adminSliderService.createSlider(req.body, req.file);
  res.redirect(url('/admin/sliders'));
}

async function showEditForm(req, res) {
  const slider = await adminSliderService.getForEdit(req.params.id);
  if (!slider) {
    return res.status(404).render('pages/error', {
      title: 'Not Found',
      statusCode: 404,
      message: 'We could not find that slide.',
    });
  }
  res.render('admin/sliders/form', { title: 'Edit Slide', mode: 'edit', slider });
}

async function update(req, res) {
  await adminSliderService.updateSlider(req.params.id, req.body, req.file);
  res.redirect(url('/admin/sliders'));
}

module.exports = { list, showCreateForm, create, showEditForm, update };
