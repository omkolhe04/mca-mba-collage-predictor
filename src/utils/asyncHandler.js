/**
 * Wraps an async controller/route function so rejected promises
 * are automatically forwarded to next(err), instead of every
 * controller needing its own try/catch. Keeps controllers small.
 *
 * Usage: router.get('/', asyncHandler(controller.someMethod));
 */
'use strict';

function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
