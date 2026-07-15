'use strict';

const env = require('../config/env');

/**
 * Builds an internal path that's correct whether this app is
 * deployed at a domain root/subdomain (env.basePath === '', the
 * normal case) or under a subdirectory via a reverse proxy (e.g.
 * cPanel's PassengerBaseURI — env.basePath === '/some-folder').
 *
 * Every internal link, form action, and redirect in this app
 * should be built through this function rather than a hardcoded
 * string starting with '/' — a hardcoded absolute path is
 * resolved by the browser against the domain root, which silently
 * breaks navigation for any subdirectory deployment (the root
 * cause of a real bug hit in production: every link on the site
 * pointed to the wrong URL once deployed under
 * kadiyamcomponents.com/collage.predictor).
 *
 * `path` must start with '/'. Passing an external URL (http://...)
 * is not what this is for — use it as-is in that case.
 *
 * Examples (with env.basePath = '/collage.predictor'):
 *   url('/predict')              -> '/collage.predictor/predict'
 *   url('/admin/users/' + id)    -> '/collage.predictor/admin/users/abc123'
 * Examples (with env.basePath = '', the normal/default case):
 *   url('/predict')              -> '/predict' (unchanged)
 */
function url(path) {
  return `${env.basePath}${path}`;
}

module.exports = { url };
