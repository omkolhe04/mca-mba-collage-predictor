'use strict';

const supabase = require('../config/supabase');
const { unwrap } = require('./base.repository');
const AppError = require('../utils/AppError');

async function create(data) {
  const result = await supabase.from('import_batches').insert(data).select().single();
  return unwrap(result, 'Could not create import batch record');
}

async function update(id, data) {
  const result = await supabase.from('import_batches').update(data).eq('id', id).select().single();
  return unwrap(result, 'Could not update import batch record');
}

async function findById(id) {
  const result = await supabase.from('import_batches').select('*').eq('id', id).maybeSingle();
  return unwrap(result);
}

/**
 * All import batches for an exam type, most recent first, with
 * the importing admin's name embedded (null for CLI-run imports,
 * which have no admin session).
 */
async function findAllByExamType(examTypeId) {
  const result = await supabase
    .from('import_batches')
    .select('*, admins(name)')
    .eq('exam_type_id', examTypeId)
    .order('created_at', { ascending: false });
  if (result.error) {
    throw AppError.internal(`Database error: ${result.error.message}`);
  }
  return result.data || [];
}

async function deleteById(id) {
  const result = await supabase.from('import_batches').delete().eq('id', id);
  if (result.error) {
    throw AppError.internal(`Database error: ${result.error.message}`);
  }
}

async function deleteAllByExamType(examTypeId) {
  const result = await supabase.from('import_batches').delete().eq('exam_type_id', examTypeId).select('id');
  if (result.error) {
    throw AppError.internal(`Database error: ${result.error.message}`);
  }
  return (result.data || []).length;
}

module.exports = { create, update, findById, findAllByExamType, deleteById, deleteAllByExamType };
