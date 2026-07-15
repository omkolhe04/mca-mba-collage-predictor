'use strict';

const supabase = require('../config/supabase');
const { unwrap } = require('./base.repository');
const AppError = require('../utils/AppError');

async function findAllPaginated({ page = 1, pageSize = 20 }) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const result = await supabase
    .from('notifications')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
  if (result.error) {
    throw AppError.internal(`Database error: ${result.error.message}`);
  }
  return { rows: result.data || [], total: result.count || 0 };
}

async function findById(id) {
  const result = await supabase.from('notifications').select('*').eq('id', id).maybeSingle();
  return unwrap(result);
}

async function create(data) {
  const result = await supabase.from('notifications').insert(data).select().single();
  return unwrap(result, 'Could not create notification');
}

async function update(id, data) {
  const result = await supabase.from('notifications').update(data).eq('id', id).select().single();
  return unwrap(result, 'Could not update notification');
}

/**
 * Notifications currently within their active window — what the
 * public site displays. `starts_at`/`ends_at` are optional, so a
 * notification with either left blank is treated as having no
 * bound on that side.
 */
async function findActiveNow() {
  const nowIso = new Date().toISOString();
  const result = await supabase
    .from('notifications')
    .select('*')
    .eq('is_active', true)
    .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
    .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
    .order('created_at', { ascending: false })
    .limit(5);
  if (result.error) {
    throw AppError.internal(`Database error: ${result.error.message}`);
  }
  return result.data || [];
}

module.exports = { findAllPaginated, findById, create, update, findActiveNow };
