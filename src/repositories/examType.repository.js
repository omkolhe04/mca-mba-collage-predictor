'use strict';

const supabase = require('../config/supabase');
const { unwrap } = require('./base.repository');

async function findByCode(code) {
  const result = await supabase.from('exam_types').select('*').eq('code', code).maybeSingle();
  return unwrap(result);
}

async function findById(id) {
  const result = await supabase.from('exam_types').select('*').eq('id', id).maybeSingle();
  return unwrap(result);
}

/**
 * Every active exam type, in a stable order — feeds the exam
 * selection step on the prediction form and any admin exam-type
 * selector/dropdown.
 */
async function findAllActive() {
  const result = await supabase.from('exam_types').select('*').eq('is_active', true).order('name', { ascending: true });
  return unwrap(result) || [];
}

/**
 * Every exam type regardless of active status — for the admin
 * Manage Exam Types screen, which needs to see (and re-activate)
 * inactive ones too.
 */
async function findAll() {
  const result = await supabase.from('exam_types').select('*').order('name', { ascending: true });
  return unwrap(result) || [];
}

async function update(id, data) {
  const result = await supabase.from('exam_types').update(data).eq('id', id).select().single();
  return unwrap(result, 'Could not update exam type');
}

async function create(data) {
  const result = await supabase.from('exam_types').insert(data).select().single();
  return unwrap(result, 'Could not create exam type');
}

module.exports = { findByCode, findById, findAllActive, findAll, update, create };
