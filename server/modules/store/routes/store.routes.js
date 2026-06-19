const express = require('express');
const router = express.Router();
const storeController = require('../controllers/store.controller');
const { isAuthenticated, requireStaff, requireStaffOrDoctor } = require('../../auth/middleware/auth.middleware');

router.get('/search', isAuthenticated, storeController.searchHospitals);

router.get('/staff/details', isAuthenticated, requireStaffOrDoctor, storeController.getStaffStoreDetails);
router.patch(
  '/staff/doctors/:doctorId/availability',
  isAuthenticated,
  requireStaff,
  storeController.updateDoctorAvailability
);

// Get specific hospital and its doctors
router.get('/:id', isAuthenticated, storeController.getHospitalDetails);

module.exports = router;
