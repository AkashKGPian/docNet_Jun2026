const Fuse = require('fuse.js');
const drugDatabase = require('../data/drugDatabase.json');

/**
 * Drug Match Service
 * 
 * Uses Fuse.js to fuzzy-match handwriting recognition text against our local Indian drug database.
 */

// Configure Fuse.js options per PRD Section 5.6
const fuseOptions = {
  keys: ['generic_name', 'brand_names'],
  threshold: 0.4,           // strictness of match: 0.0 is exact, 1.0 is match anything
  distance: 100,            // maximum distance score
  includeScore: true,       // required to implement the red-dotted underline logic
  ignoreLocation: true,     
  minMatchCharLength: 3     // don't match 1-2 letter words perfectly
};

// Initialize the Fuse instance
const fuse = new Fuse(drugDatabase, fuseOptions);

/**
 * Fuzzy search the drug database for a given text query.
 * 
 * @param {string} text - The word/phrase to search for
 * @returns {Array} - Array of top matching drug objects with scores
 */
function searchDrug(text) {
  if (!text || text.length < 3) {
    return [];
  }

  // Get raw Fuse.js results
  const results = fuse.search(text);

  // Map to a cleaner format to send to frontend
  return results.map(result => ({
    generic: result.item.generic_name,
    matchedBrand: result.item.brand_names.find(b => b.toLowerCase().includes(text.toLowerCase())) || null,
    category: result.item.category,
    allBrands: result.item.brand_names,
    commonDoses: result.item.common_doses,
    score: result.score, // e.g., 0.0 to 0.4
  }));
}

/**
 * Determine if a word should trigger the red-underline suggestion system.
 * Based on PRD rules: 
 * - Score <= 0.0 -> exact match (no underline)
 * - Score <= 0.2 -> close match (RED DOTTED UNDERLINE)
 * - Score > 0.2 -> poor match (probably not a drug, ignore)
 */
function evaluateDrugMatch(text) {
  const matches = searchDrug(text);
  
  if (matches.length === 0) {
    return { isDrug: false, exactMatch: false, needsUnderline: false, suggestions: [] };
  }

  const bestMatch = matches[0];
  const score = bestMatch.score;

  // Due to floating point math, check very close to 0
  const isExact = score <= 0.01;
  const isClose = score > 0.01 && score <= 0.25; // using 0.25 as practical threshold for 80%

  return {
    isDrug: isExact || isClose,
    exactMatch: isExact,
    needsUnderline: isClose,
    bestMatch: bestMatch,
    suggestions: matches.slice(0, 5) // Top 5 suggestions
  };
}

module.exports = {
  searchDrug,
  evaluateDrugMatch
};
