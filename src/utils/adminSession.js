'use strict';

const env = require('../config/env');

const ADMIN_COOKIE_NAME = 'vn_admin_token';

/**
 * Parses simple duration shorthand ('8h', '7d', '30m', '45s') —
 * the same format jsonwebtoken's `expiresIn` accepts — into
 * milliseconds, so the cookie's maxAge always matches the JWT's
 * actual expiry without duplicating the value in two formats.
 */
function parseDurationToMs(duration) {
  const match = /^(\d+)(s|m|h|d)$/.exec(String(duration).trim());
  if (!match) {
    return 8 * 60 * 60 * 1000; // fallback: 8 hours
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const unitMs = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
  return value * unitMs[unit];
}

/**
 * Sets the admin JWT cookie. Not using cookie-parser's "signed"
 * wrapper here — the JWT itself is already tamper-proof via its
 * own signature, so double-signing the cookie adds nothing.
 * Scoped to {basePath}/admin via `path` so it's never sent on
 * public-site requests. The basePath prefix matters for
 * subdirectory deployments (e.g. cPanel PassengerBaseURI) — the
 * browser's real URL is /some-folder/admin/..., not /admin/...,
 * and a cookie path only matches what's actually in the browser's
 * address bar, regardless of how the server-side proxy rewrites
 * it internally. Without this, admin login would silently never
 * persist under a subdirectory deployment.
 */
function setAdminTokenCookie(res, token) {
  res.cookie(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    maxAge: parseDurationToMs(env.adminAuth.jwtExpiry),
    path: `${env.basePath}/admin`,
  });
}

function clearAdminTokenCookie(res) {
  res.clearCookie(ADMIN_COOKIE_NAME, { path: `${env.basePath}/admin` });
}

function getAdminTokenFromRequest(req) {
  return req.cookies?.[ADMIN_COOKIE_NAME] || null;
}

module.exports = {
  ADMIN_COOKIE_NAME,
  parseDurationToMs,
  setAdminTokenCookie,
  clearAdminTokenCookie,
  getAdminTokenFromRequest,
};
