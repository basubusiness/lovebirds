/**
 * aiParser.js
 * Sends receipt image/PDF to /api/parse-receipt and returns { items, warning? }
 * - Images: compressed to max 1600x2000 at 85% JPEG quality
 * - PDFs: first page rendered to canvas via PDF.js, then compressed as JPEG
 */

const MAX_WIDTH  = 1600;
const MAX_HEIGHT = 2000;
const QUALITY    = 0.85;
const PDFJS_CDN  = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ── PDF.js loader (lazy, cached) ─────────────────────────────────────────────

let pdfJsLoaded = false;

async function loadPdfJs() {
  if (pdfJsLoaded || window.pdfjsLib) { pdfJsLoaded = true; return; }
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = PDFJS_CDN;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load PDF.js'));
    document.head.appendChild(script);
  });
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  pdfJsLoaded = true;
}

// ── PDF → JPEG base64 ────────────────────────────────────────────────────────

async function pdfToBase64(file) {
  await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1); // first page only

  // Render at 2x scale for better text clarity
  const viewport = page.getViewport({ scale: 2 });

  const canvas = document.createElement('canvas');
  canvas.width  = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');

  await page.render({ canvasContext: ctx, viewport }).promise;

  // Resize if too large
  let { width, height } = canvas;
  if (width > MAX_WIDTH || height > MAX_HEIGHT) {
    const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
    const resized = document.createElement('canvas');
    resized.width  = Math.round(width  * ratio);
    resized.height = Math.round(height * ratio);
    resized.getContext('2d').drawImage(canvas, 0, 0, resized.width, resized.height);
    return resized.toDataURL('image/jpeg', QUALITY).split(',')[1];
  }

  return canvas.toDataURL('image/jpeg', QUALITY).split(',')[1];
}

// ── Image → compressed JPEG base64 ───────────────────────────────────────────

async function imageToBase64(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
        width  = Math.round(width  * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', QUALITY).split(',')[1]);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      // Fallback: send raw
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result.split(',')[1]);
      reader.onerror = () => reject(new Error('Failed to read image'));
      reader.readAsDataURL(file);
    };

    img.src = url;
  });
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function parseReceipt(file, existingProducts = []) {
  let base64;
  const isPdf = file.type === 'application/pdf' || file.name?.endsWith('.pdf');

  if (isPdf) {
    base64 = await pdfToBase64(file);
  } else {
    base64 = await imageToBase64(file);
  }

  const res = await fetch('/api/parse-receipt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      base64,
      mimeType: 'image/jpeg', // always JPEG after conversion
      existingProducts: existingProducts.map(p => ({
        id:   p.id,
        name: p.name,
        unit: p.unit,
      })),
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `Server error ${res.status}`);
  }

  const data = await res.json();
  if (!Array.isArray(data.items)) throw new Error('Unexpected response from server');
  if (data.items.length === 0)    throw new Error('No items found. Try a clearer photo.');

  return { items: data.items, warning: data.warning || null };
}
