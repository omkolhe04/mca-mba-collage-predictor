'use strict';

const supabase = require('../config/supabase');
const { unwrap } = require('./base.repository');
const AppError = require('../utils/AppError');

async function findAllOrdered() {
  const result = await supabase.from('sliders').select('*').order('display_order', { ascending: true });
  if (result.error) {
    throw AppError.internal(`Database error: ${result.error.message}`);
  }
  return result.data || [];
}

async function findById(id) {
  const result = await supabase.from('sliders').select('*').eq('id', id).maybeSingle();
  return unwrap(result);
}

async function create(data) {
  const result = await supabase.from('sliders').insert(data).select().single();
  return unwrap(result, 'Could not create slider');
}

async function update(id, data) {
  const result = await supabase.from('sliders').update(data).eq('id', id).select().single();
  return unwrap(result, 'Could not update slider');
}

/**
 * Active sliders in display order — what the public homepage
 * shows.
 */
async function findActiveOrdered() {
  const result = await supabase
    .from('sliders')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });
  if (result.error) {
    throw AppError.internal(`Database error: ${result.error.message}`);
  }
  return result.data || [];
}

module.exports = { findAllOrdered, findById, create, update, findActiveOrdered };
