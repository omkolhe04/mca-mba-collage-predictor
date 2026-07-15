/**
 * Centralized error handler. Must be registered last in app.js.
 *
 * Distinguishes between:
 *  - Operational errors (AppError) -> safe, user-facing message
 *  - Unexpected errors -> generic message, full detail logged only
 *
 * Responds with JSON for API/form-fetch requests and a rendered
 * EJS error page for normal browser navigations.
 */
'use strict';

const logger = require('../utils/logger');
const env = require('../config/env');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const isOperational = err.isOperational === true;
  const message = isOperational ? err.message : 'Something went wrong. Please try again.';

  if (!isOperational) {
    logger.error('Unhandled error', {
      message: err.message,
      stack: err.stack,
      path: req.originalUrl,
    });
  } else {
    logger.warn('Operational error', {
      message: err.message,
      path: req.originalUrl,
    });
  }

  const wantsJson =
    req.xhr || req.headers.accept?.includes('application/json') || req.originalUrl.startsWith('/api');

  if (wantsJson) {
    return res.status(statusCode).json({
      success: false,
      message,
      ...(err.details ? { details: err.details } : {}),
      ...(env.isProduction ? {} : { stack: err.stack }),
    });
  }

  return res.status(statusCode).render('pages/error', {
    title: 'Error',
    statusCode,
    message,
  });
}

function notFoundHandler(req, res) {
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({ success: false, message: 'Route not found' });
  }
  return res.status(404).render('pages/error', {
    title: 'Page Not Found',
    statusCode: 404,
    message: 'The page you are looking for does not exist.',
  });
}

module.exports = { errorHandler, notFoundHandler };
