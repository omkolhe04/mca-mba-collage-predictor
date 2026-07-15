'use strict';

const supabase = require('../config/supabase');
const { unwrap } = require('./base.repository');

async function findByEmail(email) {
  const result = await supabase.from('admins').select('*').eq('email', email).maybeSingle();
  return unwrap(result);
}

async function findById(id) {
  const result = await supabase.from('admins').select('*').eq('id', id).maybeSingle();
  return unwrap(result);
}

async function create(adminData) {
  const result = await supabase.from('admins').insert(adminData).select().single();
  return unwrap(result, 'Could not create admin');
}

async function updateLastLogin(id) {
  const result = await supabase
    .from('admins')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  return unwrap(result);
}

module.exports = { findByEmail, findById, create, updateLastLogin };
