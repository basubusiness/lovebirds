/**
 * aiParser.js
 * Two-step pipeline:
 * Step 1: Gemini 2.5 Flash (vision) extracts raw items from receipt image
 * Step 2: Llama 3.3 70B (free, text-only) normalizes, translates, matches inventory
 */

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export async function parseReceipt(file, existingProducts = []) {
  const base64   = await fileToBase64(file);
  const mimeType = file.type || 'image/jpeg';

  // Pass existing products so Step 2 can match aliases
  const res = await fetch('/api/parse-receipt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      base64,
      mimeType,
      existingProducts: existingProducts.map(p => ({
        id: p.id,
        name: p.name,
        unit: p.unit,
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
  if (data.items.length === 0) throw new Error('No items found. Try a clearer photo.');

  return data.items;
}
