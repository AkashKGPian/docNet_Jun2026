const express = require('express');
const router = express.Router();

const queueController = require('../controllers/queue.controller');
const { isAuthenticated, requirePatient, requireDoctor, requireStaffOrDoctor } = require('../../auth/middleware/auth.middleware');

router.get('/active', isAuthenticated, requireDoctor, queueController.getActiveQueue);

router.get('/patient/status', isAuthenticated, requirePatient, queueController.getPatientQueueStatus);

router.post('/join', isAuthenticated, requirePatient, queueController.joinQueue);

router.post('/tokens/:tokenId/cancel', isAuthenticated, requirePatient, queueController.cancelToken);

router.post('/tokens/:tokenId/call', isAuthenticated, requireDoctor, queueController.callToken);

router.post('/tokens/:tokenId/complete', isAuthenticated, requireDoctor, queueController.completeToken);

router.post('/:queueId/status', isAuthenticated, requireStaffOrDoctor, queueController.toggleQueueStatus);

module.exports = router;
