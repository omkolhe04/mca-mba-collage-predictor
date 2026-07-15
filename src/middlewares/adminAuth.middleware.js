'use strict';

const adminAuthService = require('../services/adminAuth.service');
const { getAdminTokenFromRequest } = require('../utils/adminSession');

/**
 * Protects admin routes. Redirects to /admin/login if there's no
 * valid, unexpired token — this is a server-rendered panel, not
 * an API, so a redirect is the right response rather than a 401
 * JSON body for every protected page.
 */
function requireAdminAuth(req, res, next) {
  const token = getAdminTokenFromRequest(req);
  const payload = token ? adminAuthService.verifyToken(token) : null;

  if (!payload) {
    return res.redirect('/admin/login');
  }

  req.admin = payload;
  res.locals.currentAdmin = payload;
  next();
}

module.exports = requireAdminAuth;
