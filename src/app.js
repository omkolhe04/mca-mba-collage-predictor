'use strict';

const path = require('path');
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const env = require('./config/env');
const logger = require('./utils/logger');
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');
const { url } = require('./utils/url');
const { icon } = require('./utils/icons');
const asyncHandler = require('./utils/asyncHandler');
const { getUserIdFromRequest } = require('./utils/userSession');
const predictionService = require('./services/prediction.service');
const routes = require('./routes');

const app = express();

// ---------------------------------------------------------
// Subdirectory hosting fix (cPanel/Passenger)
// ---------------------------------------------------------
// When this app is deployed under a subdirectory via Passenger's
// PassengerBaseURI (e.g. cPanel's "Setup Node.js App" with an
// Application URL like example.com/some-folder), Passenger is
// supposed to strip that prefix before forwarding the request to
// this app. In practice, some cPanel/Passenger configurations
// fail to strip it specifically for the bare base-directory
// request (both with and without a trailing slash), while still
// stripping it correctly for every deeper path — meaning
// /some-folder/predict works fine, but /some-folder/ itself 404s.
//
// This rewrites the bare base-path request to '/' before routing,
// and is a no-op everywhere else. Only takes effect if
// APP_SUBDIRECTORY_BASE_PATH is set (leave unset for domain-root
// or subdomain deployments, where this never applies).
if (env.basePath) {
  const base = env.basePath;
  app.use((req, res, next) => {
    if (req.url === base || req.url === `${base}/`) {
      req.url = '/';
    }
    next();
  });
}

// ---------------------------------------------------------
// View engine
// ---------------------------------------------------------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');

// ---------------------------------------------------------
// Security & performance middleware
// ---------------------------------------------------------
app.use(
  helmet({
    contentSecurityPolicy: false, // enabled explicitly once CDN sources are finalized
  })
);
app.use(compression());

// ---------------------------------------------------------
// Request logging
// ---------------------------------------------------------
app.use(morgan(env.isProduction ? 'combined' : 'dev', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// ---------------------------------------------------------
// Body & cookie parsing
// ---------------------------------------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(env.userSession.secret));

// ---------------------------------------------------------
// Static assets
// ---------------------------------------------------------
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---------------------------------------------------------
// Locals available to every view
// ---------------------------------------------------------
app.use((req, res, next) => {
  res.locals.appName = env.appName;
  res.locals.currentPath = req.path;
  res.locals.url = url;
  res.locals.icon = icon;
  // Success confirmation banner (e.g. "Exam type created") — set
  // by appending ?success=... to a redirect target. Read here so
  // every view can show it consistently without each controller
  // needing its own rendering logic; harmless on pages that never
  // set it (this is just null in that case).
  res.locals.successMessage = req.query.success || null;
  next();
});

// ---------------------------------------------------------
// Returning-user experience: exposes the current visitor's most
// recent prediction (if any) to every public view, so the
// navbar/hero can show "Start Prediction" vs "View My
// Prediction" / "✨ New Prediction" without each page needing
// its own lookup. Skipped entirely for admin/api routes (cheap
// path check) — neither needs this, and it avoids an unnecessary
// DB query on every admin request.
// ---------------------------------------------------------
app.use(
  asyncHandler(async (req, res, next) => {
    if (req.path.startsWith('/admin') || req.path.startsWith('/api')) {
      res.locals.latestPrediction = null;
      return next();
    }
    const userId = getUserIdFromRequest(req);
    res.locals.latestPrediction = userId ? await predictionService.getLatestPredictionForUser(userId) : null;
    next();
  })
);

// ---------------------------------------------------------
// Routes
// ---------------------------------------------------------
app.use('/', routes);

// ---------------------------------------------------------
// 404 + Error handling (must be last)
// ---------------------------------------------------------
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
