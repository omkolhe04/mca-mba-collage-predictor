/**
 * Minimal, dependency-free logger.
 * Keeps a consistent log shape across the app so we can later
 * swap in a file/rotating transport without touching call sites.
 */
'use strict';

const env = require('../config/env');

function timestamp() {
  return new Date().toISOString();
}

function format(level, message, meta) {
  const base = `[${timestamp()}] [${level}] ${message}`;
  if (meta && Object.keys(meta).length > 0) {
    return `${base} ${JSON.stringify(meta)}`;
  }
  return base;
}

const logger = {
  info(message, meta) {
    console.log(format('INFO', message, meta));
  },
  warn(message, meta) {
    console.warn(format('WARN', message, meta));
  },
  error(message, meta) {
    console.error(format('ERROR', message, meta));
  },
  debug(message, meta) {
    if (!env.isProduction) {
      console.debug(format('DEBUG', message, meta));
    }
  },
};

module.exports = logger;
