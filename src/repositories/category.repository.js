'use strict';

const supabase = require('../config/supabase');
const { unwrap } = require('./base.repository');

/**
 * Base admission categories only (OPEN, OBC, SC, ST, VJ, NT1-3,
 * SBC) — the special reservations (TFWS, EWS, PWD, Defence,
 * Minority) are separate checkboxes in the form, not part of
 * this dropdown, and are stored as is_special = true.
 */
async function findAllBaseCategories() {
  const result = await supabase
    .from('categories')
    .select('id, code, name')
    .eq('is_special', false)
    .eq('is_active', true)
    .order('display_order', { ascending: true });
  return unwrap(result) || [];
}

/**
 * Every active category (base + special reservations), for
 * pages that need to label data by category without filtering
 * to eligibility — e.g. the College Details cutoff/fee tables,
 * which show official published data for all categories.
 */
async function findAll() {
  const result = await supabase
    .from('categories')
    .select('id, code, name, is_special, display_order')
    .eq('is_active', true)
    .order('display_order', { ascending: true });
  return unwrap(result) || [];
}

async function findById(id) {
  const result = await supabase.from('categories').select('*').eq('id', id).maybeSingle();
  return unwrap(result);
}

/**
 * Resolves category codes (e.g. 'TFWS', 'EWS') to their rows.
 * Used by the Prediction Engine to work out every category a
 * student is eligible to be evaluated against.
 */
async function findManyByCodes(codes) {
  if (!codes || codes.length === 0) {
    return [];
  }
  const result = await supabase
    .from('categories')
    .select('id, code, name')
    .in('code', codes)
    .eq('is_active', true);
  return unwrap(result) || [];
}

async function existsById(id) {
  const category = await findById(id);
  return category !== null;
}

module.exports = { findAllBaseCategories, findAll, findById, findManyByCodes, existsById };
