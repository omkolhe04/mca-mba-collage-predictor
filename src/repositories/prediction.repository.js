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
};
