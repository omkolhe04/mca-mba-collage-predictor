'use strict';

const supabase = require('../config/supabase');
const { unwrap } = require('./base.repository');
const AppError = require('../utils/AppError');

/**
 * Inserts a new prediction record holding only the submitted
 * inputs. `result_snapshot` is left at its DB default ('{}')
 * until the Prediction Engine (Phase 4) populates it.
 */
async function create(predictionData) {
  const result = await supabase.from('predictions').insert(predictionData).select().single();
  return unwrap(result, 'Could not save prediction');
}

async function findById(id) {
  const result = await supabase.from('predictions').select('*').eq('id', id).maybeSingle();
  return unwrap(result);
}

/**
 * Persists the Prediction Engine's computed output onto an
 * existing prediction row. Called once, right after the row is
 * first created with just its inputs.
 */
async function updateResultSnapshot(id, resultSnapshot) {
  const result = await supabase
    .from('predictions')
    .update({ result_snapshot: resultSnapshot })
    .eq('id', id)
    .select()
    .single();
  return unwrap(result, 'Could not save prediction result');
}

async function countAll(examTypeId) {
  let query = supabase.from('predictions').select('id', { count: 'exact', head: true });
  if (examTypeId) {
    query = query.eq('exam_type_id', examTypeId);
  }
  const result = await query;
  if (result.error) {
    throw AppError.internal(`Database error: ${result.error.message}`);
  }
  return result.count || 0;
}

/**
 * Most recent predictions, for the admin dashboard's activity
 * feed. Joins in the user's name via a nested select — this is
 * a read-only dashboard view, not a hot path, so the join cost
 * is a reasonable tradeoff against an extra round trip.
 */
async function findRecent(limit = 10, examTypeId) {
  let query = supabase
    .from('predictions')
    .select('id, percentile, created_at, users(name, mobile)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (examTypeId) {
    query = query.eq('exam_type_id', examTypeId);
  }
  const result = await query;
  if (result.error) {
    throw AppError.internal(`Database error: ${result.error.message}`);
  }
  return result.data || [];
}

async function findByUserId(userId) {
  const result = await supabase
    .from('predictions')
    .select('id, percentile, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (result.error) {
    throw AppError.internal(`Database error: ${result.error.message}`);
  }
  return result.data || [];
}

/**
 * The single most recent prediction for a user, full row — used
 * by the returning-user experience to decide whether to redirect
 * straight to a result, and to pre-fill the "New Prediction" form.
 * Returns null if the user has never submitted one.
 */
async function findLatestByUserId(userId) {
  const result = await supabase
    .from('predictions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return unwrap(result);
}

/**
 * Overwrites an existing prediction's INPUT fields (not its
 * result_snapshot — see updateResultSnapshot for that) — used
 * when a returning user submits a new prediction, so they end up
 * with exactly one current prediction row rather than a new one
 * appended each time.
 */
async function updateInputs(id, predictionData) {
  const result = await supabase.from('predictions').update(predictionData).eq('id', id).select().single();
  return unwrap(result, 'Could not update prediction');
}

/**
 * Prediction counts grouped by category, for the dashboard
 * analytics breakdown. Fetches category name + created_at for
 * every prediction in the given window and aggregates in JS —
 * simplest reliable approach without a Postgres RPC/view, and
 * prediction volume is modest enough that this stays cheap.
 */
async function findCategoryBreakdown(examTypeId) {
  let query = supabase.from('predictions').select('categories(name)');
  if (examTypeId) {
    query = query.eq('exam_type_id', examTypeId);
  }
  const result = await query;
  if (result.error) {
    throw AppError.internal(`Database error: ${result.error.message}`);
  }
  const counts = new Map();
  for (const row of result.data || []) {
    const name = row.categories?.name || 'Unknown';
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Prediction counts per day for the last N days, for the
 * dashboard's activity chart. Zero-fills days with no
 * submissions so the chart doesn't have gaps.
 */
async function findDailyCounts(days = 14, examTypeId) {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  let query = supabase.from('predictions').select('created_at').gte('created_at', since.toISOString());
  if (examTypeId) {
    query = query.eq('exam_type_id', examTypeId);
  }
  const result = await query;
  if (result.error) {
    throw AppError.internal(`Database error: ${result.error.message}`);
  }

  const countsByDate = new Map();
  for (const row of result.data || []) {
    const dateKey = row.created_at.slice(0, 10); // YYYY-MM-DD
    countsByDate.set(dateKey, (countsByDate.get(dateKey) || 0) + 1);
  }

  const series = [];
  for (let i = 0; i < days; i += 1) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    series.push({ date: key, count: countsByDate.get(key) || 0 });
  }
  return series;
}

/**
 * Average percentile across all predictions for an exam (or all
 * exams if examTypeId is omitted) — computed in JS after a
 * lightweight fetch of just the percentile column, consistent
 * with this file's existing pattern of aggregating small result
 * sets in memory rather than relying on Postgres-side aggregate
 * functions through Supabase's query builder.
 */
async function findAveragePercentile(examTypeId) {
  let query = supabase.from('predictions').select('percentile');
  if (examTypeId) {
    query = query.eq('exam_type_id', examTypeId);
  }
  const result = await query;
  if (result.error) {
    throw AppError.internal(`Database error: ${result.error.message}`);
  }
  const rows = result.data || [];
  if (rows.length === 0) return 0;
  const sum = rows.reduce((acc, row) => acc + Number(row.percentile || 0), 0);
  return Math.round((sum / rows.length) * 100) / 100;
}

/**
 * Prediction counts for today, the last 7 days, and the last 30
 * days, all scoped to one exam — a single query covering the
 * widest window (30 days), with the narrower windows derived in
 * JS from the same result set rather than three separate queries.
 */
async function findRecentActivityCounts(examTypeId) {
  const startOf30DaysAgo = new Date();
  startOf30DaysAgo.setDate(startOf30DaysAgo.getDate() - 29);
  startOf30DaysAgo.setHours(0, 0, 0, 0);

  let query = supabase.from('predictions').select('created_at').gte('created_at', startOf30DaysAgo.toISOString());
  if (examTypeId) {
    query = query.eq('exam_type_id', examTypeId);
  }
  const result = await query;
  if (result.error) {
    throw AppError.internal(`Database error: ${result.error.message}`);
  }

  const todayKey = new Date().toISOString().slice(0, 10);
  const startOf7DaysAgo = new Date();
  startOf7DaysAgo.setDate(startOf7DaysAgo.getDate() - 6);
  startOf7DaysAgo.setHours(0, 0, 0, 0);

  let today = 0;
  let last7Days = 0;
  let last30Days = 0;
  for (const row of result.data || []) {
    const createdAt = new Date(row.created_at);
    last30Days += 1;
    if (createdAt >= startOf7DaysAgo) last7Days += 1;
    if (row.created_at.slice(0, 10) === todayKey) today += 1;
  }
  return { today, last7Days, last30Days };
}

/**
 * How many predictions used each Admission University, for one
 * exam — university names are resolved via a small batch lookup
 * (the universities table is tiny), same pattern as
 * adminUser.repository.js.
 */
async function findUniversityDistribution(examTypeId) {
  let query = supabase.from('predictions').select('admission_university_id');
  if (examTypeId) {
    query = query.eq('exam_type_id', examTypeId);
  }
  const result = await query;
  if (result.error) {
    throw AppError.internal(`Database error: ${result.error.message}`);
  }

  const counts = new Map();
  for (const row of result.data || []) {
    if (!row.admission_university_id) continue;
    counts.set(row.admission_university_id, (counts.get(row.admission_university_id) || 0) + 1);
  }

  const ids = [...counts.keys()];
  if (ids.length === 0) return [];

  const uniResult = await supabase.from('universities').select('id, name, short_name').in('id', ids);
  if (uniResult.error) {
    throw AppError.internal(`Database error: ${uniResult.error.message}`);
  }
  const namesById = new Map((uniResult.data || []).map((u) => [u.id, u.short_name || u.name]));

  return Array.from(counts.entries())
    .map(([id, count]) => ({ university: namesById.get(id) || 'Unknown', count }))
    .sort((a, b) => b.count - a.count);
}

async function findGenderDistribution(examTypeId) {
  let query = supabase.from('predictions').select('gender');
  if (examTypeId) {
    query = query.eq('exam_type_id', examTypeId);
  }
  const result = await query;
  if (result.error) {
    throw AppError.internal(`Database error: ${result.error.message}`);
  }
  const counts = new Map();
  for (const row of result.data || []) {
    const gender = row.gender || 'Unknown';
    counts.set(gender, (counts.get(gender) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([gender, count]) => ({ gender, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * MCA vs MBA (or however many exams exist) — deliberately NOT
 * scoped to a single exam, since the whole point is comparing
 * across all of them.
 */
async function findExamDistribution() {
  const result = await supabase.from('predictions').select('exam_types(name)');
  if (result.error) {
    throw AppError.internal(`Database error: ${result.error.message}`);
  }
  const counts = new Map();
  for (const row of result.data || []) {
    const name = row.exam_types?.name || 'Unknown';
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([exam, count]) => ({ exam, count }))
    .sort((a, b) => b.count - a.count);
}

module.exports = {
  create,
  findById,
  updateResultSnapshot,
  countAll,
  findRecent,
  findByUserId,
  findLatestByUserId,
  updateInputs,
  findCategoryBreakdown,
  findDailyCounts,
  findAveragePercentile,
  findRecentActivityCounts,
  findUniversityDistribution,
  findGenderDistribution,
  findExamDistribution,
};