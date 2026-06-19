const { evaluateDrugMatch, searchDrug } = require('../services/drugMatch.service');
const drugDatabase = require('../data/drugDatabase.json');

/**
 * DRUG CONTROLLER — DocNet MVP
 * 
 * Provides drug endpoints for fuzzy matching and downloading the database.
 */

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH DRUG DATABSE
// ─────────────────────────────────────────────────────────────────────────────
exports.searchDrugs = (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Search query is required.' });
    }

    // Use evaluate method to get exact/close match flags and top suggestions
    const matchAnalysis = evaluateDrugMatch(query);

    return res.status(200).json({
      success: true,
      query: query,
      isDrug: matchAnalysis.isDrug,
      needsUnderline: matchAnalysis.needsUnderline, // frontend red-dotted underline
      exactMatch: matchAnalysis.exactMatch,
      topSuggestions: matchAnalysis.suggestions
    });
  } catch (error) {
    console.error('Search Drugs Error:', error);
    return res.status(500).json({ error: 'Internal server error during drug search.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET ENTIRE DRUG DATABASE (For client-side local matching)
// ─────────────────────────────────────────────────────────────────────────────
exports.getAllDrugs = (req, res) => {
  try {
    // Send the static JSON file
    return res.status(200).json({
      success: true,
      count: drugDatabase.length,
      drugs: drugDatabase
    });
  } catch (error) {
    console.error('Get All Drugs Error:', error);
    return res.status(500).json({ error: 'Internal server error fetching drug database.' });
  }
};
