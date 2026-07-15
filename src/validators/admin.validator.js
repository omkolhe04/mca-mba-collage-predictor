'use strict';

const { body } = require('express-validator');

const adminLoginValidators = [
  body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Enter a valid email'),
  body('password').notEmpty().withMessage('Password is required'),
];

const collegeFormValidators = [
  body('collegeCode').trim().notEmpty().withMessage('College code is required').isLength({ max: 20 }),
  body('name').trim().notEmpty().withMessage('College name is required').isLength({ max: 300 }),
  body('city').trim().optional({ checkFalsy: true }).isLength({ max: 120 }),
  body('district').trim().optional({ checkFalsy: true }).isLength({ max: 120 }),
  body('address').trim().optional({ checkFalsy: true }),
  body('pincode').trim().optional({ checkFalsy: true }).isLength({ max: 10 }),
  body('websiteUrl').trim().optional({ checkFalsy: true }).isURL().withMessage('Enter a valid website URL'),
  body('googleMapsUrl').trim().optional({ checkFalsy: true }).isURL().withMessage('Enter a valid Google Maps URL'),
  body('universityId').trim().optional({ checkFalsy: true }).isUUID().withMessage('Select a valid university'),
  body('naacGrade').trim().optional({ checkFalsy: true }).isLength({ max: 10 }),
  body('establishedYear')
    .optional({ checkFalsy: true })
    .isInt({ min: 1800, max: new Date().getFullYear() })
    .withMessage('Enter a valid year'),
  body('intakeCapacity').optional({ checkFalsy: true }).isInt({ min: 0 }).withMessage('Intake capacity must be a positive number'),
  // Checkboxes are handled as plain 'on'/absent in the controller, not validated here.
];

module.exports = { adminLoginValidators, collegeFormValidators };
