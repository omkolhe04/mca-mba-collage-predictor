'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const pageController = require('../controllers/page.controller');

router.get('/', asyncHandler(pageController.renderLanding));

module.exports = router;
