'use strict';

const express = require('express');
const multer = require('multer');
const router = express.Router();

const asyncHandler = require('../utils/asyncHandler');
const requireAdminAuth = require('../middlewares/adminAuth.middleware');
const validateRequest = require('../middlewares/validateRequest');
const { adminLoginValidators, collegeFormValidators } = require('../validators/admin.validator');

const adminAuthController = require('../controllers/adminAuth.controller');
const adminDashboardController = require('../controllers/adminDashboard.controller');
const adminCollegeController = require('../controllers/adminCollege.controller');
const adminImportController = require('../controllers/adminImport.controller');
const adminUserController = require('../controllers/adminUser.controller');
const adminNotificationController = require('../controllers/adminNotification.controller');
const adminSliderController = require('../controllers/adminSlider.controller');
const adminUniversityController = require('../controllers/adminUniversity.controller');
const adminExamTypeController = require('../controllers/adminExamType.controller');

const adminCollegeService = require('../services/adminCollege.service');
const { url } = require('../utils/url');

// 10MB cap comfortably covers a full year's cutoff JSON for one
// exam type; kept in memory (not written to disk) since the
// import engine just needs the parsed content, not a file path.
const uploadJson = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Separate, smaller limit for slider images, restricted to
// actual image types.
const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    cb(null, allowed.includes(file.mimetype));
  },
});

// Every admin view renders inside the admin layout (sidebar
// nav), never the public site's header/footer layout.
router.use((req, res, next) => {
  res.locals.layout = 'layouts/admin';
  next();
});

// ---------------------------------------------------------
// Public — must come before the auth gate below
// ---------------------------------------------------------
router.get('/login', asyncHandler(adminAuthController.showLogin));
router.post(
  '/login',
  adminLoginValidators,
  validateRequest('admin/login', async () => ({ title: 'Admin Login' })),
  asyncHandler(adminAuthController.login)
);
router.post('/logout', asyncHandler(adminAuthController.logout));

// ---------------------------------------------------------
// Everything below requires a valid admin session
// ---------------------------------------------------------
router.use(requireAdminAuth);

router.get('/', (req, res) => res.redirect(url('/admin/dashboard')));
router.get('/dashboard', asyncHandler(adminDashboardController.showDashboard));

router.get('/exam-types', asyncHandler(adminExamTypeController.list));
router.get('/exam-types/new', asyncHandler(adminExamTypeController.showCreateForm));
router.post('/exam-types', asyncHandler(adminExamTypeController.create));
router.get('/exam-types/:id/edit', asyncHandler(adminExamTypeController.showEditForm));
router.post('/exam-types/:id', asyncHandler(adminExamTypeController.update));

router.get('/colleges', asyncHandler(adminCollegeController.list));
router.get('/colleges/new', asyncHandler(adminCollegeController.showCreateForm));
router.post(
  '/colleges',
  collegeFormValidators,
  validateRequest('admin/colleges/form', async (req) => {
    const { universities, examTypes } = await adminCollegeService.getFormLookups();
    return { title: 'Add College', mode: 'create', universities, examTypes, college: req.body };
  }),
  asyncHandler(adminCollegeController.create)
);
router.get('/colleges/:id/edit', asyncHandler(adminCollegeController.showEditForm));
router.post(
  '/colleges/:id',
  collegeFormValidators,
  validateRequest('admin/colleges/form', async (req) => {
    const [{ universities }, extras] = await Promise.all([
      adminCollegeService.getFormLookups(),
      adminCollegeService.getPlacementsAndFees(req.params.id),
    ]);
    return { title: 'Edit College', mode: 'edit', universities, college: { id: req.params.id, ...req.body }, ...extras };
  }),
  asyncHandler(adminCollegeController.update)
);

router.get('/import', asyncHandler(adminImportController.showForm));
router.post('/import', uploadJson.single('cutoffFile'), asyncHandler(adminImportController.handleUpload));
router.post('/import/:id/delete', asyncHandler(adminImportController.deleteBatch));
router.post('/import/reset-all', asyncHandler(adminImportController.resetData));

router.get('/users', asyncHandler(adminUserController.list));
router.get('/users/export.csv', asyncHandler(adminUserController.exportCsv));
router.get('/users/predictions/:predictionId/detail', asyncHandler(adminUserController.detailPartial));
router.get('/users/:id', asyncHandler(adminUserController.detail));
router.post('/users/:id/toggle-active', asyncHandler(adminUserController.toggleActive));

router.post('/colleges/:id/placements', asyncHandler(adminCollegeController.addPlacement));
router.post('/colleges/:id/fees', asyncHandler(adminCollegeController.addFee));

router.get('/notifications', asyncHandler(adminNotificationController.list));
router.get('/notifications/new', asyncHandler(adminNotificationController.showCreateForm));
router.post('/notifications', asyncHandler(adminNotificationController.create));
router.get('/notifications/:id/edit', asyncHandler(adminNotificationController.showEditForm));
router.post('/notifications/:id', asyncHandler(adminNotificationController.update));

router.get('/sliders', asyncHandler(adminSliderController.list));
router.get('/sliders/new', asyncHandler(adminSliderController.showCreateForm));
router.post('/sliders', uploadImage.single('image'), asyncHandler(adminSliderController.create));
router.get('/sliders/:id/edit', asyncHandler(adminSliderController.showEditForm));
router.post('/sliders/:id', uploadImage.single('image'), asyncHandler(adminSliderController.update));

router.get('/universities', asyncHandler(adminUniversityController.list));
router.get('/universities/:universityId/whatsapp/:examTypeId/edit', asyncHandler(adminUniversityController.showEditForm));
router.post('/universities/:universityId/whatsapp/:examTypeId', asyncHandler(adminUniversityController.update));

module.exports = router;