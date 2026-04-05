/**
 * Vercel Serverless Function — /api/parse-receipt
 *
 * Receives a base64-encoded receipt image or PDF from the frontend,
 * calls Gemini with the hidden API key, and returns parsed items.
 *
 * The GEMINI_API_KEY environment variable is set in Vercel's dashboard
 * and is never exposed to the browser.
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

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured on server' });
  }

  const { base64, mimeType } = req.body;
  if (!base64 || !mimeType) {
    return res.status(400).json({ error: 'Missing base64 or mimeType in request body' });
  }

  try {
    const geminiRes = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: PROMPT },
              { inline_data: { mime_type: mimeType, data: base64 } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!geminiRes.ok) {
      const err = await geminiRes.json().catch(() => ({}));
      return res.status(geminiRes.status).json({
        error: err?.error?.message || `Gemini error ${geminiRes.status}`,
      });
    }

    const data = await geminiRes.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    const clean = text.replace(/```json|```/g, '').trim();
    const items = JSON.parse(clean);

    if (!Array.isArray(items)) throw new Error('Unexpected response format');

    return res.status(200).json({ items });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed to parse receipt' });
  }
}
