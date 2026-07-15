'use strict';

const supabase = require('../config/supabase');
const env = require('../config/env');
const AppError = require('../utils/AppError');

/**
 * Uploads a file buffer to Supabase Storage and returns the
 * object path (not the full public URL — the URL is computed on
 * read via getPublicImageUrl, so it stays correct even if the
 * bucket's public URL/domain ever changes).
 *
 * NOTE: requires the configured bucket (SUPABASE_STORAGE_BUCKET)
 * to be set to public in the Supabase dashboard, since slider
 * images are meant to be publicly visible on the homepage.
 */
async function uploadImage(path, buffer, contentType) {
  const { error } = await supabase.storage
    .from(env.supabase.storageBucket)
    .upload(path, buffer, { contentType, upsert: true });

  if (error) {
    throw AppError.internal(`Storage upload failed: ${error.message}`);
  }
  return path;
}

function getPublicImageUrl(path) {
  if (!path) return null;
  const { data } = supabase.storage.from(env.supabase.storageBucket).getPublicUrl(path);
  return data?.publicUrl || null;
}

module.exports = { uploadImage, getPublicImageUrl };
