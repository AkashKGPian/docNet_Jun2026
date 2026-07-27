const express = require('express');
const router = express.Router();

const canvasController = require('../controllers/canvas.controller');
const { isAuthenticated, requireDoctor } = require('../../auth/middleware/auth.middleware');

// ─────────────────────────────────────────────────────────────────────────────
// CANVAS ROUTES (parse recognized text from client-side Tesseract.js OCR)
// Base path: /api/canvas
// ─────────────────────────────────────────────────────────────────────────────

// Parse medicine row text (from manual entry or client OCR)
// Only doctors can access this endpoint
router.post('/recognize', isAuthenticated, requireDoctor, canvasController.recognizeImage);

module.exports = router;
