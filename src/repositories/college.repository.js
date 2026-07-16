'use strict';

const supabase = require('../config/supabase');
const { unwrap } = require('./base.repository');
const AppError = require('../utils/AppError');

/**
 * Colleges for the given exam type, for the Dream College
 * dropdown. Returns an empty array until Phase 8's import
 * engine loads real CAP cutoff/college data — that's expected,
 * not an error condition.
 */
async function findAllActiveByExamType(examTypeId) {
  const result = await supabase
    .from('colleges')
    .select('id, name, city, university_id')
    .eq('exam_type_id', examTypeId)
    .eq('is_active', true)
    .order('name', { ascending: true });
  return unwrap(result) || [];
}

async function findById(id) {
  const result = await supabase.from('colleges').select('*').eq('id', id).maybeSingle();
  return unwrap(result);
}

/**
 * Alias kept separate from findById for readability at call
 * sites — this page genuinely wants every column (address,
 * NAAC, AICTE, hostel, etc.), not just the lookup-dropdown shape.
 */
async function findFullById(id) {
  return findById(id);
}

async function existsById(id) {
  const college = await findById(id);
  return college !== null;
}

/**
 * Full display detail for a set of colleges — used by the
 * Result Page (Phase 5) to enrich the engine's chance data with
 * NAAC/autonomy/hostel/website info before rendering.
 */
async function findDetailsByIds(collegeIds) {
  if (!collegeIds || collegeIds.length === 0) {
    return [];
  }
  const result = await supabase
    .from('colleges')
    .select('id, name, city, naac_grade, autonomous, hostel_available, website_url, google_maps_url')
    .in('id', collegeIds);
  return unwrap(result) || [];
}

/**
 * Bulk create-or-update colleges by (exam_type_id, college_code)
 * — used by the cutoff import engine. Because the upsert payload
 * only includes college_code/name (not address, NAAC, fees,
 * etc.), Postgres's ON CONFLICT DO UPDATE only touches those
 * listed columns — admin-entered profile data on existing
 * colleges is never overwritten by a cutoff re-import.
 */
async function upsertMany(collegeRows) {
  if (!collegeRows || collegeRows.length === 0) {
    return [];
  }
  const result = await supabase
    .from('colleges')
    .upsert(collegeRows, { onConflict: 'exam_type_id,college_code' })
    .select('id, college_code');
  return unwrap(result) || [];
}

async function countAll(examTypeId) {
  const result = await supabase
    .from('colleges')
    .select('id', { count: 'exact', head: true })
    .eq('exam_type_id', examTypeId);
  if (result.error) {
    throw AppError.internal(`Database error: ${result.error.message}`);
  }
  return result.count || 0;
}

/**
 * Paginated, searchable college list for the Admin Panel.
 */
async function findAllPaginated({ examTypeId, search, page = 1, pageSize = 20 }) {
  let query = supabase
    .from('colleges')
    .select('id, college_code, name, city, university_id, is_active', { count: 'exact' })
    .eq('exam_type_id', examTypeId)
    .order('name', { ascending: true });

  if (search) {
    query = query.or(`name.ilike.%${search}%,college_code.ilike.%${search}%`);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const result = await query;
  if (result.error) {
    throw AppError.internal(`Database error: ${result.error.message}`);
  }

  const rows = result.data || [];

  // Batch-resolve university short names in one small query (the
  // universities table is tiny) rather than one query per row.
  const universityIds = [...new Set(rows.map((r) => r.university_id).filter(Boolean))];
  let universitiesById = new Map();
  if (universityIds.length > 0) {
    const uniResult = await supabase.from('universities').select('id, name, short_name').in('id', universityIds);
    if (uniResult.error) {
      throw AppError.internal(`Database error: ${uniResult.error.message}`);
    }
    universitiesById = new Map((uniResult.data || []).map((u) => [u.id, u]));
  }

  const mapped = rows.map((row) => ({
    ...row,
    university_short_name: universitiesById.get(row.university_id)?.short_name ||
      universitiesById.get(row.university_id)?.name ||
      null,
  }));

  return { rows: mapped, total: result.count || 0 };
}

async function create(collegeData) {
  const result = await supabase.from('colleges').insert(collegeData).select().single();
  return unwrap(result, 'Could not create college');
}

async function update(id, collegeData) {
  const result = await supabase.from('colleges').update(collegeData).eq('id', id).select().single();
  return unwrap(result, 'Could not update college');
}

/**
 * Deletes every college for an exam type. Relies on ON DELETE
 * CASCADE (set in migrations 008-011) to also remove their
 * branches, cutoffs, placements, and fees. Used only by the
 * admin "Reset Exam Data" danger-zone action — never called from
 * normal application flows.
 */
async function deleteAllByExamType(examTypeId) {
  const result = await supabase.from('colleges').delete().eq('exam_type_id', examTypeId).select('id');
  if (result.error) {
    throw AppError.internal(`Database error: ${result.error.message}`);
  }
  return (result.data || []).length;
}

module.exports = {
  findAllActiveByExamType,
  findById,
  findFullById,
  existsById,
  findDetailsByIds,
  upsertMany,
  countAll,
  findAllPaginated,
  create,
  update,
  deleteAllByExamType,
};