const { recognizeHandwriting, MODEL_UNSUPPORTED_HINT } = require('../services/trocr.service');
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

    if (!image && !manualText) {
      return res.status(400).json({ error: 'Either image or text is required.' });
    }

    // Manual text always works — skip cloud OCR entirely.
    if (manualText) {
      const result = parseRecognizedText(manualText);
      return res.status(200).json({
        ...result,
        source: 'manual_text',
      });
    }

    try {
      const ocrResult = await recognizeHandwriting(image);

      if (!ocrResult.configured) {
        return res.status(501).json({
          error: 'Handwriting recognition is not configured. Set HF_API_KEY or enter text manually.',
          text: '',
          parsed: emptyParsed(),
        });
      }

      if (ocrResult.unsupported) {
        return res.status(503).json({
          error: ocrResult.reason || MODEL_UNSUPPORTED_HINT,
          text: '',
          parsed: emptyParsed(),
          ocrUnavailable: true,
        });
      }

      if (!ocrResult.text) {
        return res.status(422).json({
          error: 'Could not read any text from the canvas. Enter the row in the text box instead.',
          text: '',
          parsed: emptyParsed(),
        });
      }

      const result = parseRecognizedText(ocrResult.text);
      return res.status(200).json({
        ...result,
        source: 'ocr',
      });
    } catch (ocrError) {
      console.error('TrOCR Error:', ocrError);
      return res.status(502).json({
        error: ocrError.message || 'Handwriting recognition failed. Enter the row as text instead.',
        text: '',
        parsed: emptyParsed(),
      });
    }
  } catch (error) {
    console.error('Canvas Recognize Error:', error);
    return res.status(500).json({ error: 'Internal server error during handwriting recognition.' });
  }
};
