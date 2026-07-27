const { parseRecognizedText } = require('../services/canvasParse.service');

const emptyParsed = () => ({
  drugName: '',
  dose: '',
  frequency: '',
  duration: '',
  instructions: '',
  isExactMatch: false,
});

exports.recognizeImage = async (req, res) => {
  try {
    const { image, text } = req.body || {};
    const manualText = typeof text === 'string' ? text.trim() : '';

    if (!manualText) {
      if (image) {
        return res.status(410).json({
          error: 'Server-side image OCR is no longer supported. Handwriting is recognized in the browser — draw on the pad and click Recognize, or send { text }.',
          text: '',
          parsed: emptyParsed(),
        });
      }
      return res.status(400).json({ error: 'Text is required.' });
    }

    const result = parseRecognizedText(manualText);
    return res.status(200).json({
      ...result,
      source: 'manual_text',
    });
  } catch (error) {
    console.error('Canvas Recognize Error:', error);
    return res.status(500).json({ error: 'Internal server error during handwriting recognition.' });
  }
};
