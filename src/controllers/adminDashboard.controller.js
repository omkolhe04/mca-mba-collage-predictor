'use strict';

const adminDashboardService = require('../services/adminDashboard.service');

async function showDashboard(req, res) {
  const examTypeCode = req.query.exam || null;
  const stats = await adminDashboardService.getDashboardStats(examTypeCode);
  res.render('admin/dashboard', { title: 'Dashboard', stats });
}

module.exports = { showDashboard };
