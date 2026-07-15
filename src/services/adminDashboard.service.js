'use strict';

const collegeRepository = require('../repositories/college.repository');
const userRepository = require('../repositories/user.repository');
const predictionRepository = require('../repositories/prediction.repository');
const lookupService = require('./lookup.service');

/**
 * Dashboard stats for a specific exam type (defaults to MCA CET
 * if none specified). Colleges and prediction-related stats
 * (counts, recent activity, category breakdown, daily volume)
 * are all scoped to the selected exam. Total users is
 * deliberately NOT exam-scoped — a user isn't tied to a single
 * exam in this schema (they could submit predictions for more
 * than one), so "total users" is always a global count.
 */
async function getDashboardStats(examTypeCode) {
  const { examType, allExamTypes } = await lookupService.resolveExamTypeSelection(examTypeCode);

  const [totalColleges, totalUsers, totalPredictions, recentPredictions, categoryBreakdown, dailyCounts] =
    await Promise.all([
      collegeRepository.countAll(examType.id),
      userRepository.countAll(),
      predictionRepository.countAll(examType.id),
      predictionRepository.findRecent(10, examType.id),
      predictionRepository.findCategoryBreakdown(examType.id),
      predictionRepository.findDailyCounts(14, examType.id),
    ]);

  return {
    examType,
    allExamTypes,
    totalColleges,
    totalUsers,
    totalPredictions,
    recentPredictions: recentPredictions.map((p) => ({
      id: p.id,
      percentile: p.percentile,
      createdAt: p.created_at,
      userName: p.users?.name || 'Unknown',
      userMobile: p.users?.mobile || '',
    })),
    categoryBreakdown,
    dailyCounts,
  };
}

module.exports = { getDashboardStats };
