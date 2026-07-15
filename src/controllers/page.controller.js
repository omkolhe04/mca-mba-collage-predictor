'use strict';

const publicContentService = require('../services/publicContent.service');

/**
 * Controllers stay thin: extract request data, call a service,
 * render/respond. No business logic lives here.
 */

async function renderLanding(req, res) {
  const [notifications, sliders] = await Promise.all([
    publicContentService.getActiveNotifications(),
    publicContentService.getActiveSliders(),
  ]);

  res.render('pages/landing', {
    notifications,
    sliders,
  });
}

module.exports = { renderLanding };
