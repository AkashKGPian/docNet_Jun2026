const express = require('express');
const router = express.Router();

const prescriptionController = require('../controllers/prescription.controller');
const {
  isAuthenticated,
  requireDoctor,
  requirePatient,
} = require('../../auth/middleware/auth.middleware');

router.post('/process', isAuthenticated, requireDoctor, prescriptionController.processPrescription);

router.post('/confirm', isAuthenticated, requireDoctor, prescriptionController.confirmPrescriptionFromCanvas);

router.post('/access/grant', isAuthenticated, requirePatient, prescriptionController.grantHistoryAccess);
router.post('/access/revoke', isAuthenticated, requirePatient, prescriptionController.revokeHistoryAccess);
router.get('/access', isAuthenticated, requirePatient, prescriptionController.listHistoryAccess);

router.get('/history/:patientId?', isAuthenticated, prescriptionController.getPatientPrescriptions);

router.get('/:id', isAuthenticated, prescriptionController.getPrescriptionById);

module.exports = router;
