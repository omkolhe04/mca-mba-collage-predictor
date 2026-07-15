'use strict';

const supabase = require('../config/supabase');
const { unwrap } = require('./base.repository');

/**
 * Standard (category_id IS NULL) fee rows for a set of colleges,
 * most recent academic_year first. Category-specific fee rows
 * (e.g. a distinct TFWS fee) are a Phase 6+ concern for the full
 * college detail page — the result page shows the standard fee
 * only, as a simple at-a-glance figure.
 */
async function findStandardByCollegeIds(collegeIds) {
  if (!collegeIds || collegeIds.length === 0) {
    return [];
  }
  const result = await supabase
    .from('fees')
    .select('college_id, academic_year, annual_fee')
    .in('college_id', collegeIds)
    .is('category_id', null)
    .order('academic_year', { ascending: false });
  return unwrap(result) || [];
}

/**
 * Every fee row for a single college — standard fee plus any
 * category-specific rows (e.g. a distinct TFWS fee) — for the
 * College Details page's full fee breakdown.
 */
async function findAllByCollegeId(collegeId) {
  const result = await supabase
    .from('fees')
    .select('academic_year, annual_fee, total_course_fee, category_id')
    .eq('college_id', collegeId)
    .order('academic_year', { ascending: false });
  return unwrap(result) || [];
}

/**
 * Create-or-update a fee row. `fees` has TWO partial unique
 * indexes rather than one plain constraint (see migration
 * 011_fees.sql) — one for category-specific rows, one for the
 * standard (category_id IS NULL) row — because Postgres treats
 * NULL as distinct in a normal unique constraint. The onConflict
 * target has to match whichever index applies, so this branches
 * on whether category_id is present.
 */
async function upsertOne(feeData) {
  const onConflict = feeData.category_id ? 'college_id,academic_year,category_id' : 'college_id,academic_year';
  const result = await supabase.from('fees').upsert(feeData, { onConflict }).select().single();
  return unwrap(result, 'Could not save fee');
}

module.exports = { findStandardByCollegeIds, findAllByCollegeId, upsertOne };
