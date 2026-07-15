/**
 * Centralized environment configuration.
 * Never read process.env directly anywhere else in the app —
 * always import from here. This makes config changes and
 * validation a single-point concern.
 */
'use strict';

require('dotenv').config();

const REQUIRED_VARS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'USER_SESSION_SECRET',
  'ADMIN_JWT_SECRET',
];

function validateEnv() {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        'Copy .env.example to .env and fill in the values.'
    );
  }
}

validateEnv();

/**
 * Normalizes APP_SUBDIRECTORY_BASE_PATH defensively — treats
 * unset, empty, whitespace-only, or the literal strings
 * "undefined"/"null" (which can end up in an env var by mistake,
 * e.g. via a hosting panel or a stray .env line) all as "not
 * subdirectory-hosted", rather than trusting the raw value
 * blindly. Also guarantees the result either is '' or starts
 * with exactly one '/' and has no trailing slash, so url()
 * can never produce a broken relative path from a malformed
 * value like "admin" (missing leading slash) or "admin/" (extra
 * trailing slash).
 */
function normalizeBasePath(raw) {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed || trimmed.toLowerCase() === 'undefined' || trimmed.toLowerCase() === 'null') {
    return '';
  }
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/+$/, '');
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: parseInt(process.env.PORT, 10) || 3000,
  appName: process.env.APP_NAME || 'MCA | MBA College Predictor',
  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:3000',

  // Set this ONLY when deployed under a subdirectory via a
  // reverse proxy / Passenger PassengerBaseURI (e.g. cPanel's
  // "Setup Node.js App" with an Application URL like
  // example.com/some-folder). Leave unset for domain-root or
  // subdomain deployments (including local dev on localhost). See
  // src/utils/url.js for what this enables — every internal
  // link, redirect, and cookie path in the app is built through
  // that helper using this value.
  basePath: normalizeBasePath(process.env.APP_SUBDIRECTORY_BASE_PATH),

  supabase: {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    storageBucket: process.env.SUPABASE_STORAGE_BUCKET || 'vidyaniti-assets',
  },

  userSession: {
    secret: process.env.USER_SESSION_SECRET,
    cookieName: process.env.USER_SESSION_COOKIE_NAME || 'vn_uid',
    maxAgeDays: parseInt(process.env.USER_SESSION_MAX_AGE_DAYS, 10) || 365,
  },

  adminAuth: {
    jwtSecret: process.env.ADMIN_JWT_SECRET,
    jwtExpiry: process.env.ADMIN_JWT_EXPIRY || '8h',
  },

  pdf: {
    brandName: process.env.PDF_BRAND_NAME || 'MCA | MBA College Predictor',
    watermarkText: process.env.PDF_WATERMARK_TEXT || 'MCA | MBA College Predictor',
  },
};

module.exports = env;
