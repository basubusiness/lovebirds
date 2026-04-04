/**
 * aiParser.js
 * Sends a receipt image or PDF to Google Gemini and returns
 * a structured list of purchased items with quantities and units.
 *
 * To switch to OpenAI later: replace callGemini() with callOpenAI()
 * and update parseResponse() — nothing else changes.
 */

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

const PROMPT = `You are a household inventory assistant. Analyze this receipt or order document.

Extract every purchased item and return ONLY a valid JSON array — no markdown, no explanation, no backticks.

Each item in the array must have exactly these fields:
- "name": string — clean product name (e.g. "Whole Milk", "Dishwasher Tabs")
- "quantity": number — numeric quantity purchased
- "unit": string — one of: pc, kg, g, L, ml, pack
- "vendorGuess": string — best guess at vendor name from receipt header (or "Unknown")
- "confidence": string — "high", "medium", or "low"

Rules:
- Convert multipacks to base units where clear (e.g. "6x1L milk" → quantity 6, unit L)
- If unit is ambiguous, use "pc"
- Skip non-product lines (discounts, taxes, subtotals, loyalty points)
- If you cannot read the receipt clearly, return an empty array []

Return only the JSON array, nothing else.`;

/**
 * Convert a File object to base64 string
 */
async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Main entry point — accepts an image or PDF File object
 * Returns array of parsed items or throws on error
 */
export async function parseReceipt(file, apiKey) {
  if (!apiKey?.trim()) throw new Error('No Gemini API key set. Add it in Settings.');

  const base64 = await fileToBase64(file);
  const mimeType = file.type || 'image/jpeg';

  const body = {
    contents: [
      {
        parts: [
          { text: PROMPT },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 1024,
    },
  };

  const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gemini API error ${res.status}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

  try {
    const clean = text.replace(/```json|```/g, '').trim();
    const items = JSON.parse(clean);
    if (!Array.isArray(items)) throw new Error('Not an array');
    return items;
  } catch {
    throw new Error('Could not parse AI response. Try a clearer image.');
  }
}
