/**
 * Regular Expression Parser & Abbreviation Expander
 * 
 * Extracts structured data (dose, frequency, duration) from raw handwritten text strings
 * and expands doctor shorthand into readable instructions.
 */

// 1. Regular Expressions for Extraction (Case-insensitive)
const DOSE_REGEX = /\d+\s?(mg|ml|g|mcg|units|iu|drops)/i;
const FREQ_REGEX = /\b([01]-[01]-[01]|BD|TDS|OD|QID|SOS|HS|PRN|STAT|BID|TID|QHS)\b/i;
const DURATION_REGEX = /(x\s?\d+\s?(days?|d|weeks?|w|months?|m)|\bfor\s+\d+\s?(days?|weeks?|months?))/i;

// 2. Abbreviation Map (Translates doctor shorthand into patient-friendly English)
const ABBREVIATIONS = {
  'aftr': 'after',
  'bfore': 'before',
  'fod': 'food',
  'brkfst': 'breakfast',
  'lnch': 'lunch',
  'dnr': 'dinner',
  'ngt': 'night',
  'mrng': 'morning',
  'tab': 'tablet',
  'cap': 'capsule',
  'inj': 'injection',
  'syr': 'syrup',
  'ac': 'before food',
  'pc': 'after food',
  'po': 'by mouth',
  'prn': 'as needed',
  'sos': 'if needed',
  'od': 'once daily',
  'bd': 'twice daily',
  'tds': 'thrice daily',
  'qid': 'four times daily',
  'hs': 'at bedtime',
  'stat': 'immediately',
  'c/o': 'complains of',
  'h/o': 'history of',
  's/o': 'suggestive of',
  'b/l': 'bilateral',
  'n/v': 'nausea/vomiting'
};

/**
 * Expands abbreviations in a string.
 * Uses word boundaries \b to ensure we don't replace parts of other words (e.g., 'tab' inside 'table').
 */
function expandAbbreviations(text) {
  if (!text) return '';
  let expanded = text;
  
  Object.keys(ABBREVIATIONS).forEach(abbr => {
    // Regex matches the abbreviation as a whole word, ignoring case
    const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
    expanded = expanded.replace(regex, ABBREVIATIONS[abbr]);
  });
  
  return expanded.trim();
}

/**
 * Parses a raw line of text into structured prescription fields.
 * 
 * @param {string} rawText - The unparsed line (e.g., "Amoxicillin 500mg TDS x 5 days pc")
 * @param {string} knownDrug - (Optional) The drug name if already identified via Fuse.js
 * @returns {Object} { drug, dose, frequency, duration, instructions }
 */
function parseRowText(rawText, knownDrug = '') {
  let remainingText = rawText;
  let parsed = {
    drug: knownDrug,
    dose: '',
    frequency: '',
    duration: '',
    instructions: ''
  };

  // 1. Extract Dose
  const doseMatch = remainingText.match(DOSE_REGEX);
  if (doseMatch) {
    parsed.dose = doseMatch[0].trim();
    remainingText = remainingText.replace(DOSE_REGEX, ''); // remove from text
  }

  // 2. Extract Frequency
  const freqMatch = remainingText.match(FREQ_REGEX);
  if (freqMatch) {
    parsed.frequency = freqMatch[0].trim();
    remainingText = remainingText.replace(FREQ_REGEX, '');
  }

  // 3. Extract Duration
  const durMatch = remainingText.match(DURATION_REGEX);
  if (durMatch) {
    parsed.duration = durMatch[0].trim();
    remainingText = remainingText.replace(DURATION_REGEX, '');
  }

  // 4. Remove known drug name from the remaining text so it doesn't end up in instructions
  if (knownDrug) {
    // Escape special chars in drug name just in case
    const safeDrugRegex = new RegExp(knownDrug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    remainingText = remainingText.replace(safeDrugRegex, '');
  }

  // 5. Whatever is left over becomes the instructions (after expanding abbreviations)
  // E.g., "pc" -> "after food"
  // E.g., "ac" -> "before food"
  const cleanInstructions = remainingText.replace(/\s+/g, ' ').trim();
  parsed.instructions = expandAbbreviations(cleanInstructions);

  return parsed;
}

module.exports = {
  parseRowText,
  expandAbbreviations
};
