'use strict';

const supabase = require('../config/supabase');
const { unwrap } = require('./base.repository');
const AppError = require('../utils/AppError');

const SORT_OPTIONS = {
  newest: { column: 'created_at', ascending: false },
  oldest: { column: 'created_at', ascending: true },
  percentile_desc: { column: 'percentile', ascending: false },
  percentile_asc: { column: 'percentile', ascending: true },
};

/**
 * The Admin Users page is really a PREDICTION-centric view — each
 * user has exactly one current prediction (see the "one
 * prediction per mobile number" model), so querying FROM
 * predictions and joining OUT to users/exam_types/categories
 * naturally gives one row per user with everything the page
 * needs. Universities are joined separately in JS below (not via
 * Supabase's embed syntax) since predictions has two separate FKs
 * to universities — home and admission — which Supabase can't
 * auto-disambiguate the way it can for the single-FK relations
 * (categories, exam_types) below.
 *
 * `sort` must be one of SORT_OPTIONS' keys; name-based sorting
 * (Name A-Z / Z-A) happens in JS after the page's rows are
 * fetched, since the sortable column (users.name) lives on the
 * joined table, not predictions itself.
 */
async function findFiltered({
  search,
  examTypeId,
  admissionUniversityId,
  categoryId,
  gender,
  dateFrom,
  dateTo,
  sort = 'newest',
  page = 1,
  pageSize = 25,
} = {}) {
  let matchingUserIds = null;
  if (search) {
    const userSearch = await supabase
      .from('users')
      .select('id')
      .or(`name.ilike.%${search}%,mobile.ilike.%${search}%,email.ilike.%${search}%`);
    if (userSearch.error) {
      throw AppError.internal(`Database error: ${userSearch.error.message}`);
    }
    matchingUserIds = (userSearch.data || []).map((row) => row.id);
    if (matchingUserIds.length === 0) {
      return { rows: [], total: 0 };
    }
  }

  const isNameSort = sort === 'name_asc' || sort === 'name_desc';
  const sortOption = SORT_OPTIONS[sort] || SORT_OPTIONS.newest;

  let query = supabase.from('predictions').select(
    `id, percentile, gender, created_at, admission_university_id, home_university_id, dream_college_id,
     users(id, name, mobile, email),
     exam_types(id, code, name),
     categories(code, name),
     result_snapshot`,
    { count: 'exact' }
  );

  if (matchingUserIds) query = query.in('user_id', matchingUserIds);
  if (examTypeId) query = query.eq('exam_type_id', examTypeId);
  if (admissionUniversityId) query = query.eq('admission_university_id', admissionUniversityId);
  if (categoryId) query = query.eq('category_id', categoryId);
  if (gender) query = query.eq('gender', gender);
  if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00.000Z`);
  if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59.999Z`);

  // Name sorting needs the joined users table sorted client-side
  // after fetch (see isNameSort below) — for every other sort,
  // order and paginate at the database level as usual.
  if (!isNameSort) {
    query = query.order(sortOption.column, { ascending: sortOption.ascending });
    const from = (page - 1) * pageSize;
    query = query.range(from, from + pageSize - 1);
  }

  const result = await query;
  if (result.error) {
    throw AppError.internal(`Database error: ${result.error.message}`);
  }

  let rows = result.data || [];
  let total = result.count || 0;

  if (isNameSort) {
    rows = rows.sort((a, b) => {
      const nameA = (a.users?.name || '').toLowerCase();
      const nameB = (b.users?.name || '').toLowerCase();
      return sort === 'name_asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });
    total = rows.length;
    const from = (page - 1) * pageSize;
    rows = rows.slice(from, from + pageSize);
  }

  // Resolve admission university names in one small batch query
  // (the lookup table is tiny — a handful of universities total),
  // rather than one query per row.
  const universityIds = [...new Set(rows.map((r) => r.admission_university_id).filter(Boolean))];
  let universitiesById = new Map();
  if (universityIds.length > 0) {
    const uniResult = await supabase.from('universities').select('id, name, short_name').in('id', universityIds);
    if (uniResult.error) {
      throw AppError.internal(`Database error: ${uniResult.error.message}`);
    }
    universitiesById = new Map((uniResult.data || []).map((u) => [u.id, u]));
  }

  const mapped = rows.map((row) => {
    const snapshot = row.result_snapshot || {};
    const firstRoundCode = snapshot.roundCodes ? snapshot.roundCodes[0] : 'CAP1';
    const firstRound = (snapshot.rounds && snapshot.rounds[firstRoundCode]) || {};
    return {
      predictionId: row.id,
      userId: row.users?.id,
      name: row.users?.name || 'Unknown',
      mobile: row.users?.mobile || '',
      email: row.users?.email || '',
      gender: row.gender,
      percentile: row.percentile,
      examTypeName: row.exam_types?.name || 'Unknown',
      examTypeCode: row.exam_types?.code || null,
      categoryName: row.categories?.name || 'Unknown',
      admissionUniversityName: universitiesById.get(row.admission_university_id)?.short_name ||
        universitiesById.get(row.admission_university_id)?.name ||
        '—',
      createdAt: row.created_at,
      chanceCounts: {
        veryHigh: (firstRound.veryHigh || []).length,
        high: (firstRound.high || []).length,
        moderate: (firstRound.moderate || []).length,
        low: (firstRound.low || []).length,
      },
    };
  });

  return { rows: mapped, total };
}

/**
 * Full detail for the "View Details" drawer — a single
 * prediction, joined with everything the drawer needs, including
 * fields findFiltered's list view doesn't bother selecting
 * (home university, dream college, full chance breakdown).
 */
async function findDetailByPredictionId(predictionId) {
  const result = await supabase
    .from('predictions')
    .select(
      `id, percentile, gender, created_at, admission_university_id, home_university_id, dream_college_id,
       users(id, name, mobile, email),
       exam_types(id, code, name),
       categories(code, name),
       result_snapshot`
    )
    .eq('id', predictionId)
    .maybeSingle();

  const row = unwrap(result);
  if (!row) {
    return null;
  }

  const universityIds = [row.admission_university_id, row.home_university_id].filter(Boolean);
  let universitiesById = new Map();
  if (universityIds.length > 0) {
    const uniResult = await supabase.from('universities').select('id, name, short_name').in('id', universityIds);
    if (uniResult.error) {
      throw AppError.internal(`Database error: ${uniResult.error.message}`);
    }
    universitiesById = new Map((uniResult.data || []).map((u) => [u.id, u]));
  }

  let dreamCollegeName = null;
  if (row.dream_college_id) {
    const collegeResult = await supabase.from('colleges').select('name').eq('id', row.dream_college_id).maybeSingle();
    dreamCollegeName = collegeResult.data ? collegeResult.data.name : null;
  }

  const snapshot = row.result_snapshot || {};
  const firstRoundCode = snapshot.roundCodes ? snapshot.roundCodes[0] : 'CAP1';
  const firstRound = (snapshot.rounds && snapshot.rounds[firstRoundCode]) || {};

  return {
    predictionId: row.id,
    name: row.users?.name || 'Unknown',
    mobile: row.users?.mobile || '',
    email: row.users?.email || '',
    gender: row.gender,
    percentile: row.percentile,
    examTypeName: row.exam_types?.name || 'Unknown',
    categoryName: row.categories?.name || 'Unknown',
    homeUniversityName: universitiesById.get(row.home_university_id)?.name || '—',
    admissionUniversityName: universitiesById.get(row.admission_university_id)?.name || '—',
    dreamCollegeName: dreamCollegeName || 'Not set',
    createdAt: row.created_at,
    chanceCounts: {
      veryHigh: (firstRound.veryHigh || []).length,
      high: (firstRound.high || []).length,
      moderate: (firstRound.moderate || []).length,
      low: (firstRound.low || []).length,
    },
  };
}

module.exports = { findFiltered, findDetailByPredictionId };
