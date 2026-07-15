/**
 * Invisible user session handling.
 *
 * There is no login/signup in this product. Instead, once a user
 * submits the prediction form and a user record is created/updated
 * (keyed by mobile number), we drop a long-lived signed cookie
 * containing their user UUID. On future visits, this lets us
 * silently recognize the returning user and re-link them to their
 * latest prediction — without ever showing "log in".
 *
 * The cookie is signed (HMAC) using cookie-parser's signed-cookie
 * support, keyed off USER_SESSION_SECRET, so it cannot be forged
 * or tampered with client-side.
 */
'use strict';

const env = require('../config/env');

const COOKIE_NAME = env.userSession.cookieName;
const MAX_AGE_MS = env.userSession.maxAgeDays * 24 * 60 * 60 * 1000;

/**
 * Set the signed identity cookie for a user.
 * @param {import('express').Response} res
 * @param {string} userId - UUID of the user record
 */
function setUserSessionCookie(res, userId) {
  res.cookie(COOKIE_NAME, userId, {
    signed: true,
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    maxAge: MAX_AGE_MS,
    path: '/',
  });
}

/**
 * Read the current user's UUID from the request, if present.
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function getUserIdFromRequest(req) {
  return req.signedCookies?.[COOKIE_NAME] || null;
}

module.exports = {
  COOKIE_NAME,
  setUserSessionCookie,
  getUserIdFromRequest,
};
