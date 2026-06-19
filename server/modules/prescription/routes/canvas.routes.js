const express = require('express');
const router = express.Router();

const canvasController = require('../controllers/canvas.controller');
const { isAuthenticated, requireDoctor } = require('../../auth/middleware/auth.middleware');

// ─────────────────────────────────────────────────────────────────────────────
// CANVAS ROUTES (TrOCR Proxy)
// Base path: /api/canvas
// ─────────────────────────────────────────────────────────────────────────────

// Send a raw base64 PNG from the scribble canvas to Hugging Face TrOCR
// Only doctors can access this endpoint
router.post('/recognize', isAuthenticated, requireDoctor, canvasController.recognizeImage);

module.exports = router;
