/**
 * aiParser.js
 * Sends receipt image to /api/parse-receipt and returns { items, warning? }
 * Compresses image before sending to stay within Vercel's 4.5MB body limit.
 */

const MAX_WIDTH  = 1600;  // px — enough for Gemini to read text clearly
const MAX_HEIGHT = 2000;  // px
const QUALITY    = 0.85;  // JPEG quality

/**
 * Compress and resize an image file using a canvas, then return base64.
 * Falls back to raw base64 if canvas is unavailable (e.g. PDF).
 */
async function compressImage(file) {
  // Only compress images — pass PDFs through as-is
  if (!file.type.startsWith('image/')) {
    return fileToBase64(file);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Calculate new dimensions keeping aspect ratio
      let { width, height } = img;
      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
        width  = Math.round(width  * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // Export as JPEG base64
      const dataUrl = canvas.toDataURL('image/jpeg', QUALITY);
      resolve(dataUrl.split(',')[1]);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      // Fall back to raw
      fileToBase64(file).then(resolve).catch(reject);
    };

    img.src = url;
  });
}

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Returns { items: [...], warning?: string }
 */
export async function parseReceipt(file, existingProducts = []) {
  const base64   = await compressImage(file);
  const mimeType = file.type.startsWith('image/') ? 'image/jpeg' : (file.type || 'image/jpeg');

  const res = await fetch('/api/parse-receipt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      base64,
      mimeType,
      existingProducts: existingProducts.map(p => ({
        id:     p.id,
        name:   p.name,
        unit:   p.unit,
        vendor: p.vendor,
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

  return {
    items:   data.items,
    warning: data.warning || null,
  };
}
