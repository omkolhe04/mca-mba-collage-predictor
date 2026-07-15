'use strict';

const supabase = require('../config/supabase');
const { unwrap } = require('./base.repository');

/**
 * Active branches for a set of colleges. For MCA CET this is
 * effectively one branch per college; for a future Engineering
 * reuse of this schema, a college can have many.
 */
async function findActiveByCollegeIds(collegeIds) {
  if (!collegeIds || collegeIds.length === 0) {
    return [];
  }
  const result = await supabase
    .from('college_branches')
    .select('id, college_id, branch_name')
    .in('college_id', collegeIds)
    .eq('is_active', true);
  return unwrap(result) || [];
}

/**
 * Bulk create-or-update branches by (college_id, branch_code) —
 * used by the cutoff import engine.
 */
async function upsertMany(branchRows) {
  if (!branchRows || branchRows.length === 0) {
    return [];
  }
  const result = await supabase
    .from('college_branches')
    .upsert(branchRows, { onConflict: 'college_id,branch_code' })
    .select('id, college_id, branch_code');
  return unwrap(result) || [];
}

module.exports = { findActiveByCollegeIds, upsertMany };
