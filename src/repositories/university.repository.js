'use strict';

const supabase = require('../config/supabase');
const { unwrap } = require('./base.repository');

async function findAllActive() {
  const result = await supabase
    .from('universities')
    .select('id, name, short_name')
    .eq('is_active', true)
    .order('name', { ascending: true });
  return unwrap(result) || [];
}

async function findById(id) {
  const result = await supabase.from('universities').select('*').eq('id', id).maybeSingle();
  return unwrap(result);
}

/**
 * Every university regardless of active status — for the admin
 * WhatsApp Groups management screen.
 */
async function findAll() {
  const result = await supabase.from('universities').select('*').order('name', { ascending: true });
  return unwrap(result) || [];
}

async function update(id, data) {
  const result = await supabase.from('universities').update(data).eq('id', id).select().single();
  return unwrap(result, 'Could not update university');
}

async function existsById(id) {
  const university = await findById(id);
  return university !== null;
}

module.exports = { findAllActive, findById, findAll, update, existsById };