/**
 * aiParser.js
 * Sends receipt image to /api/parse-receipt and returns { items, warning? }
 */

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
 *   items   — array of normalised receipt items (always present, may be raw if Step 2 degraded)
 *   warning — human-readable note if Step 2 fell back to raw mode
 */
export async function parseReceipt(file, existingProducts = []) {
  const base64   = await fileToBase64(file);
  const mimeType = file.type || 'image/jpeg';

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

  // Return both items and optional warning so ReceiptModal can show the banner
  return {
    items:   data.items,
    warning: data.warning || null,
  };
}
