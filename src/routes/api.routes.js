'use strict';

const express = require('express');
const router = express.Router();

const asyncHandler = require('../utils/asyncHandler');
const apiController = require('../controllers/api.controller');

router.get('/colleges', asyncHandler(apiController.getColleges));

module.exports = router;
