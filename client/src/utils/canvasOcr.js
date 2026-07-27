/** @see tesseract.js PSM.SINGLE_LINE */
const SINGLE_LINE_PSM = '7';

const SCALE = 2;
const CONTRAST = 1.4;
const THRESHOLD = 160;

let workerPromise = null;

async function loadTesseract() {
  const mod = await import('tesseract.js');
  return mod.default ?? mod;
}

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await loadTesseract();
      const worker = await createWorker('eng', 1, {
        logger: () => {},
      });
      await worker.setParameters({
        tessedit_pageseg_mode: SINGLE_LINE_PSM,
      });
      return worker;
    })().catch((error) => {
      workerPromise = null;
      throw error;
    });
  }
  return workerPromise;
}

export async function terminateOcrWorker() {
  if (workerPromise) {
    const worker = await workerPromise;
    await worker.terminate();
    workerPromise = null;
  }
}

export function exportDrawingToCanvas(svgElement, width, height) {
  if (!svgElement || width <= 0 || height <= 0) {
    return Promise.reject(new Error('Invalid drawing surface for export.'));
  }

  const clone = svgElement.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  if (!clone.getAttribute('viewBox')) {
    clone.setAttribute('viewBox', `0 0 ${width} ${height}`);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width * SCALE;
  canvas.height = height * SCALE;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(SCALE, SCALE);

  const svgData = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        resolve(canvas);
      } catch (error) {
        URL.revokeObjectURL(url);
        reject(error);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to export drawing as image.'));
    };
    img.src = url;
  });
}

export function preprocessForOcr(sourceCanvas) {
  const canvas = document.createElement('canvas');
  canvas.width = sourceCanvas.width;
  canvas.height = sourceCanvas.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(sourceCanvas, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;

  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const contrasted = Math.min(255, Math.max(0, (gray - 128) * CONTRAST + 128));
    const value = contrasted >= THRESHOLD ? 255 : 0;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export async function recognizeHandwritingFromCanvas(canvas, onProgress) {
  try {
    const worker = await getWorker();
    const { data } = await worker.recognize(canvas, {}, onProgress);
    return (data.text || '').trim();
  } catch (error) {
    workerPromise = null;
    throw error;
  }
}
