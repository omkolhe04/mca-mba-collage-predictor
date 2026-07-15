/**
 * Small shared helper so every repository handles Supabase
 * errors the same way, instead of each one reinventing
 * `if (error) throw ...`.
 */
'use strict';

const AppError = require('../utils/AppError');

/**
 * Unwraps a Supabase response, throwing a consistent AppError
 * on failure instead of returning a {data, error} tuple that
 * every caller would otherwise have to check manually.
 */
function unwrap({ data, error }, notFoundMessage) {
  if (error) {
    throw AppError.internal(`Database error: ${error.message}`);
  }
  if (notFoundMessage && (data === null || data === undefined)) {
    throw AppError.notFound(notFoundMessage);
  }
  return data;
}

module.exports = { unwrap };
