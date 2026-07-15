/**
 * Operational error class.
 * Services/controllers throw AppError for expected failure cases
 * (validation, not found, etc.) so the central error middleware
 * can distinguish them from unexpected bugs and respond correctly.
 */
'use strict';

class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, details = null) {
    return new AppError(message, 400, details);
  }

  static notFound(message = 'Resource not found') {
    return new AppError(message, 404);
  }

  static unauthorized(message = 'Unauthorized') {
    return new AppError(message, 401);
  }

  static forbidden(message = 'Forbidden') {
    return new AppError(message, 403);
  }

  static internal(message = 'Something went wrong') {
    return new AppError(message, 500);
  }
}

module.exports = AppError;
