'use strict';

const express = require('express');
const router = express.Router();

const pageRoutes = require('./page.routes');
const predictionRoutes = require('./prediction.routes');
const collegeRoutes = require('./college.routes');
const adminRoutes = require('./admin.routes');
const apiRoutes = require('./api.routes');

router.use('/predict', predictionRoutes);
router.use('/colleges', collegeRoutes);
router.use('/admin', adminRoutes);
router.use('/api', apiRoutes);
router.use('/', pageRoutes);

module.exports = router;
