'use strict';

const collegeRepository = require('../repositories/college.repository');
const userRepository = require('../repositories/user.repository');
const predictionRepository = require('../repositories/prediction.repository');
const lookupService = require('./lookup.service');

/**
 * Dashboard stats for a specific exam type (defaults to MCA CET
 * if none specified). EVERYTHING here is scoped to the selected
 * exam, including total users - this fixes a real bug where the
 * MCA and MBA tabs previously showed an identical user count,
 * because countAll() had no exam filter at all. That was valid
 * under the OLD data model (a user could submit predictions for
 * multiple exams), but is outdated now that each mobile number
 * has exactly one current prediction (see the "one prediction
 * per number" model) - a user's single prediction IS their exam
 * choice, so "total users" can and should be exam-scoped too.
 *
 * Exam Distribution (MCA vs MBA) is the one deliberate exception
 * - it exists specifically to compare across exams, so it's
 * fetched once, unscoped, regardless of which tab is selected.
 */
async function getDashboardStats(examTypeCode) {
  const { examType, allExamTypes } = await lookupService.resolveExamTypeSelection(examTypeCode);

  const [
    totalColleges,
    totalUsers,
    totalPredictions,
    recentPredictions,
    categoryBreakdown,
    dailyCounts,
    averagePercentile,
    recentActivity,
    universityDistribution,
    genderDistribution,
    examDistribution,
  ] = await Promise.all([
    collegeRepository.countAll(examType.id),
    userRepository.countByExamType(examType.id),
    predictionRepository.countAll(examType.id),
    predictionRepository.findRecent(10, examType.id),
    predictionRepository.findCategoryBreakdown(examType.id),
    predictionRepository.findDailyCounts(30, examType.id),
    predictionRepository.findAveragePercentile(examType.id),
    predictionRepository.findRecentActivityCounts(examType.id),
    predictionRepository.findUniversityDistribution(examType.id),
    predictionRepository.findGenderDistribution(examType.id),
    predictionRepository.findExamDistribution(),
  ]);

  return {
    examType,
    allExamTypes,
    totalColleges,
    totalUsers,
    totalPredictions,
    averagePercentile,
    todayPredictions: recentActivity.today,
    last7DaysPredictions: recentActivity.last7Days,
    last30DaysPredictions: recentActivity.last30Days,
    recentPredictions: recentPredictions.map((p) => ({
      id: p.id,
      percentile: p.percentile,
      createdAt: p.created_at,
      userName: p.users?.name || 'Unknown',
      userMobile: p.users?.mobile || '',
    })),
    categoryBreakdown,
    dailyCounts,
    universityDistribution,
    genderDistribution,
    examDistribution,
  };
}

module.exports = { getDashboardStats };