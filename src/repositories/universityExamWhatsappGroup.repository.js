'use strict';

const supabase = require('../config/supabase');
const { unwrap } = require('./base.repository');

/**
 * The specific WhatsApp group for one (university, exam) pair —
 * used by the result page to look up the link for the student's
 * actual Admission University AND the exam they took. Returns
 * null if that combination has never been set.
 */
async function findByUniversityAndExam(universityId, examTypeId) {
  const result = await supabase
    .from('university_exam_whatsapp_groups')
    .select('*')
    .eq('university_id', universityId)
    .eq('exam_type_id', examTypeId)
    .maybeSingle();
  return unwrap(result);
}

/**
 * Every existing (university, exam) link row — for the admin
 * grid, combined there with the full list of universities and
 * active exam types so every combination shows, including ones
 * that have never been set.
 */
async function findAll() {
  const result = await supabase.from('university_exam_whatsapp_groups').select('*');
  return unwrap(result) || [];
}

async function findById(id) {
  const result = await supabase.from('university_exam_whatsapp_groups').select('*').eq('id', id).maybeSingle();
  return unwrap(result);
}

/**
 * Creates or updates the link for a (university, exam) pair —
 * relies on the table's own unique(university_id, exam_type_id)
 * constraint to upsert correctly regardless of whether a row
 * already exists for that combination.
 */
async function upsert(universityId, examTypeId, whatsappGroupLink) {
  const result = await supabase
    .from('university_exam_whatsapp_groups')
    .upsert(
      { university_id: universityId, exam_type_id: examTypeId, whatsapp_group_link: whatsappGroupLink },
      { onConflict: 'university_id,exam_type_id' }
    )
    .select()
    .single();
  return unwrap(result, 'Could not save WhatsApp group link');
}

module.exports = { findByUniversityAndExam, findAll, findById, upsert };
