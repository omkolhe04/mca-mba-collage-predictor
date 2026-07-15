'use strict';

const express = require('express');
const router = express.Router();

const asyncHandler = require('../utils/asyncHandler');
const collegeController = require('../controllers/college.controller');

router.get('/:id', asyncHandler(collegeController.showDetail));

module.exports = router;
