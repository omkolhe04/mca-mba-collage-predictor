'use strict';

const supabase = require('../config/supabase');
const { unwrap } = require('./base.repository');

/**
 * All placement rows for a set of colleges, most recent
 * academic_year first. The caller reduces this to "latest per
 * college" — done in the service layer rather than here, since
 * PostgREST doesn't have a clean "distinct on" equivalent via
 * the JS client.
 */
async function findByCollegeIds(collegeIds) {
  if (!collegeIds || collegeIds.length === 0) {
    return [];
  }
  const result = await supabase
    .from('placements')
    .select('college_id, academic_year, average_package_lpa, highest_package_lpa')
    .in('college_id', collegeIds)
    .order('academic_year', { ascending: false });
  return unwrap(result) || [];
}

/**
 * Full placement history for one college (admin view) — unlike
 * findByCollegeIds, includes students_placed/total_eligible too.
 */
async function findAllByCollegeId(collegeId) {
  const result = await supabase
    .from('placements')
    .select('*')
    .eq('college_id', collegeId)
    .order('academic_year', { ascending: false });
  return unwrap(result) || [];
}

/**
 * Create-or-update a placement row for a college/academic_year,
 * relying on the unique(college_id, academic_year) constraint —
 * re-submitting the same year in the admin form updates it
 * rather than creating a duplicate.
 */
async function upsertOne(placementData) {
  const result = await supabase
    .from('placements')
    .upsert(placementData, { onConflict: 'college_id,academic_year' })
    .select()
    .single();
  return unwrap(result, 'Could not save placement');
}

module.exports = { findByCollegeIds, findAllByCollegeId, upsertOne };
