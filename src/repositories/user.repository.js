'use strict';

const supabase = require('../config/supabase');
const { unwrap } = require('./base.repository');
const AppError = require('../utils/AppError');

/**
 * Find a user by their mobile number (the unique natural key —
 * there is no login, so this is how a returning submitter is
 * recognized).
 */
async function findByMobile(mobile) {
  const result = await supabase.from('users').select('*').eq('mobile', mobile).maybeSingle();
  return unwrap(result);
}

async function findById(id) {
  const result = await supabase.from('users').select('*').eq('id', id).maybeSingle();
  return unwrap(result);
}

/**
 * Create or update a user in one call, keyed on mobile.
 * Uses Postgres UPSERT via Supabase's `upsert`, targeting the
 * unique `mobile` column.
 */
async function upsertByMobile(userData) {
  const result = await supabase
    .from('users')
    .upsert(userData, { onConflict: 'mobile' })
    .select()
    .single();
  return unwrap(result, 'Could not save user record');
}

async function countAll() {
  const result = await supabase.from('users').select('id', { count: 'exact', head: true });
  if (result.error) {
    throw AppError.internal(`Database error: ${result.error.message}`);
  }
  return result.count || 0;
}

/**
 * Paginated, searchable user list for the Admin Panel.
 */
async function findAllPaginated({ search, page = 1, pageSize = 20 }) {
  let query = supabase
    .from('users')
    .select('id, name, mobile, email, is_active, created_at', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (search) {
    query = query.or(`name.ilike.%${search}%,mobile.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const result = await query;
  if (result.error) {
    throw AppError.internal(`Database error: ${result.error.message}`);
  }
  return { rows: result.data || [], total: result.count || 0 };
}

async function updateActiveStatus(id, isActive) {
  const result = await supabase.from('users').update({ is_active: isActive }).eq('id', id).select().single();
  return unwrap(result, 'Could not update user');
}

module.exports = {
  findByMobile,
  findById,
  upsertByMobile,
  countAll,
  findAllPaginated,
  updateActiveStatus,
};
