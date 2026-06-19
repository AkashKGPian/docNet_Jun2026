/**
 * Hugging Face handwriting OCR proxy.
 *
 * Note: microsoft/trocr-* models are NOT available on the free hf-inference provider.
 * Drawing-only OCR will fail until you deploy a private Inference Endpoint or use manual text.
 */
const HF_MODEL =
  process.env.HF_TROCR_MODEL || 'microsoft/trocr-base-handwritten';

const HF_INFERENCE_URL = `https://router.huggingface.co/hf-inference/models/${HF_MODEL}`;

const MODEL_UNSUPPORTED_HINT =
  'Cloud handwriting OCR (TrOCR) is not available on Hugging Face free inference. Type the row in the text box and click Recognize, or deploy a private HF Inference Endpoint.';

async function parseErrorBody(response) {
  try {
    const data = await response.json();
    return data.error || data.message || JSON.stringify(data);
  } catch {
    return response.statusText;
  }
}

function isModelUnsupportedError(status, detail) {
  const message = String(detail || '').toLowerCase();
  return (
    status === 400 &&
    (message.includes('model not supported') ||
      message.includes('not supported by provider') ||
      message.includes('no provider'))
  );
}

async function recognizeHandwriting(base64Image) {
  const apiKey = process.env.HF_API_KEY;

  if (!apiKey || apiKey === 'your_hugging_face_key_here') {
    return { text: null, configured: false, unsupported: false };
  }

  const response = await fetch(HF_INFERENCE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: base64Image,
      options: { wait_for_model: true },
    }),
  });

  if (response.status === 503) {
    const detail = await parseErrorBody(response);
    throw new Error(`TrOCR model is loading or busy. Wait 30s and retry. ${detail}`);
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error(
      'Hugging Face token rejected. Create a Fine-grained token with "Make calls to Inference Providers" at https://huggingface.co/settings/tokens'
    );
  }

  if (!response.ok) {
    const detail = await parseErrorBody(response);

    if (isModelUnsupportedError(response.status, detail)) {
      return {
        text: null,
        configured: true,
        unsupported: true,
        reason: MODEL_UNSUPPORTED_HINT,
      };
    }

    throw new Error(`TrOCR request failed (${response.status}): ${detail}`);
  }

  const result = await response.json();
  const text = Array.isArray(result)
    ? result[0]?.generated_text
    : result.generated_text;

  return {
    text: typeof text === 'string' ? text.trim() : '',
    configured: true,
    unsupported: false,
  };
}

module.exports = {
  recognizeHandwriting,
  MODEL_UNSUPPORTED_HINT,
};
