const { parseRowText } = require('./parser.service');

/**
 * Gemini service fallback — DocNet MVP
 *
 * The project spec expects an LLM-backed enhancement layer, but the runtime
 * in this workspace does not include that integration yet. These local
 * fallbacks keep the server bootable and produce deterministic output.
 */
async function enhanceClinicalNotes(drugNamesArray = [], clinicalNotes = '') {
  const heading = drugNamesArray.length > 0 ? `Prescription for ${drugNamesArray.join(', ')}` : 'Clinical Notes';

  return {
    heading,
    correctedNotes: clinicalNotes?.trim() || '',
  };
}

async function fallbackRowParse(rawText = '') {
  const parsed = parseRowText(rawText);

  return {
    ...parsed,
    isExactMatch: false,
  };
}

module.exports = {
  enhanceClinicalNotes,
  fallbackRowParse,
};