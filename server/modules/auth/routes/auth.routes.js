const express = require('express');
const router = express.Router();

const patientAuth = require('../controllers/patient.auth');
const staffAuth = require('../controllers/staff.auth');
const staffDoctor = require('../controllers/staff.doctor.controller');
const doctorAuth = require('../controllers/doctor.auth');
const csrfController = require('../controllers/csrf.controller');
const { handleProfilePhotoUpload } = require('../middleware/upload.middleware');
const { isAuthenticated, requirePatient, requireStaff, requireDoctor } = require('../middleware/auth.middleware');

// ─────────────────────────────────────────────────────────────────────────────
// PATIENT AUTH ROUTES
// Base path: /api/auth/patient
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/auth/csrf-token
// Issues a CSRF token cookie and response value used by mutating requests.
router.get('/csrf-token', csrfController.getCsrfToken);

// POST /api/auth/patient/signup
// Register a new patient and log them in
router.post('/patient/signup', patientAuth.signup);

// POST /api/auth/patient/login
// Log in an existing patient
router.post('/patient/login', patientAuth.login);

// POST /api/auth/patient/logout
// Log out (clears httpOnly cookie)
router.post('/patient/logout', patientAuth.logout);

// GET /api/auth/patient/me
// Get current logged-in patient profile (session check)
router.get('/patient/me', isAuthenticated, requirePatient, patientAuth.getCurrentUser);

router.patch('/patient/profile', isAuthenticated, requirePatient, patientAuth.updateProfile);

router.post(
  '/patient/profile/photo',
  isAuthenticated,
  requirePatient,
  handleProfilePhotoUpload,
  patientAuth.uploadProfilePhoto
);

// ─────────────────────────────────────────────────────────────────────────────
// STAFF AUTH ROUTES
// Base path: /api/auth/staff
// ─────────────────────────────────────────────────────────────────────────────

router.post('/staff/login', staffAuth.login);
router.post('/staff/logout', staffAuth.logout);
router.get('/staff/me', isAuthenticated, requireStaff, staffAuth.getCurrentStaff);

// ── Staff doctor & department management ─────────────────────────────────────
router.get('/staff/doctors/template', isAuthenticated, requireStaff, staffDoctor.getDemoTemplate);
router.post('/staff/doctors/seed', isAuthenticated, requireStaff, staffDoctor.seedDemoDoctor);
router.get('/staff/doctors', isAuthenticated, requireStaff, staffDoctor.listDoctors);
router.post('/staff/doctors', isAuthenticated, requireStaff, staffDoctor.createDoctor);
router.get('/staff/doctors/:doctorId', isAuthenticated, requireStaff, staffDoctor.getDoctor);
router.patch('/staff/doctors/:doctorId', isAuthenticated, requireStaff, staffDoctor.updateDoctor);
router.delete('/staff/doctors/:doctorId', isAuthenticated, requireStaff, staffDoctor.deleteDoctor);

router.get('/staff/departments', isAuthenticated, requireStaff, staffDoctor.listDepartments);
router.post('/staff/departments', isAuthenticated, requireStaff, staffDoctor.addDepartment);
router.patch('/staff/departments', isAuthenticated, requireStaff, staffDoctor.renameDepartment);
router.delete('/staff/departments/:name', isAuthenticated, requireStaff, staffDoctor.removeDepartment);

// ─────────────────────────────────────────────────────────────────────────────
// DOCTOR AUTH ROUTES
// Base path: /api/auth/doctor
// ─────────────────────────────────────────────────────────────────────────────

router.post('/doctor/login', doctorAuth.login);
router.post('/doctor/logout', doctorAuth.logout);

// Get current logged-in doctor profile (session check)
router.get('/doctor/me', isAuthenticated, requireDoctor, doctorAuth.getCurrentDoctor);

module.exports = router;
