/**
 * Checks express-validator's accumulated results. On failure,
 * for normal (non-JSON) form submissions, re-renders the given
 * view with the errors and the user's previously entered values
 * so they never lose their input. Every controller that uses
 * this passes the view name and a function to rebuild that
 * view's other required locals (dropdown options, etc).
 */
'use strict';

const { validationResult } = require('express-validator');

function validateRequest(viewName, buildExtraLocals) {
  return async function middleware(req, res, next) {
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    const wantsJson = req.xhr || req.headers.accept?.includes('application/json');
    if (wantsJson) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const extraLocals = buildExtraLocals ? await buildExtraLocals(req) : {};
      return res.status(400).render(viewName, {
        errors: errors.mapped(),
        formValues: req.body,
        ...extraLocals,
      });
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = validateRequest;
