const express = require('express');
const router = express.Router();

const platformAuth = require('../controllers/platform.auth');
const platformController = require('../controllers/platform.controller');
const { isAuthenticated, requirePlatformAdmin } = require('../../auth/middleware/auth.middleware');

router.post('/login', platformAuth.login);
router.post('/logout', isAuthenticated, requirePlatformAdmin, platformAuth.logout);
router.get('/me', isAuthenticated, requirePlatformAdmin, platformAuth.getCurrentUser);

router.get('/hospitals', isAuthenticated, requirePlatformAdmin, platformController.listHospitals);
router.post('/hospitals', isAuthenticated, requirePlatformAdmin, platformController.createHospital);
router.post(
  '/hospitals/:storeId/doctors',
  isAuthenticated,
  requirePlatformAdmin,
  platformController.createDoctor
);

module.exports = router;
