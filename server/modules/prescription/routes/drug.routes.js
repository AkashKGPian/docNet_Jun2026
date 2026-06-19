const express = require('express');
const router = express.Router();

const drugController = require('../controllers/drug.controller');
const { isAuthenticated, requireDoctor } = require('../../auth/middleware/auth.middleware');

// ─────────────────────────────────────────────────────────────────────────────
// DRUG ROUTES
// Base path: /api/drugs
// ─────────────────────────────────────────────────────────────────────────────

// Get the entire static drug database for local client-side caching
// Optional cache headers can be added here
router.get('/all', isAuthenticated, requireDoctor, drugController.getAllDrugs);

// Perform a fuzzy search against the drug database
// GET /api/drugs/search?query=amxciln
router.get('/search', isAuthenticated, requireDoctor, drugController.searchDrugs);

module.exports = router;
