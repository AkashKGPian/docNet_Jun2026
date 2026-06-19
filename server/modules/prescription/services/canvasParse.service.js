const { parseRowText } = require('./parser.service');
const { evaluateDrugMatch } = require('./drugMatch.service');

/**
 * Parse recognized handwriting into a structured row with drug DB matching.
 */
function parseRecognizedText(rawText) {
  const text = (rawText || '').trim();
  if (!text) {
    return {
      text: '',
      parsed: {
        drugName: '',
        dose: '',
        frequency: '',
        duration: '',
        instructions: '',
        isExactMatch: false,
      },
    };
  }

  const drugMatch = evaluateDrugMatch(text.split(/\s+/)[0] || text);
  const knownDrug = drugMatch.exactMatch
    ? drugMatch.bestMatch?.generic || ''
    : drugMatch.needsUnderline
      ? drugMatch.bestMatch?.generic || ''
      : '';

  const parsed = parseRowText(text, knownDrug);

  return {
    text,
    parsed: {
      drugName: parsed.drug || text.split(/\s+/)[0] || '',
      dose: parsed.dose,
      frequency: parsed.frequency,
      duration: parsed.duration,
      instructions: parsed.instructions,
      isExactMatch: drugMatch.exactMatch || Boolean(knownDrug && !drugMatch.needsUnderline),
      needsUnderline: drugMatch.needsUnderline,
      suggestions: drugMatch.suggestions || [],
    },
  };
}

module.exports = {
  parseRecognizedText,
};
