const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

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
- IMPORTANT: Your entire response must be valid JSON only. No text before or after the array.

Return only the JSON array, nothing else.`;

function extractJSON(text) {
  let cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('No JSON array found in response');
  cleaned = cleaned.slice(start, end + 1);
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
  try {
    return JSON.parse(cleaned);
  } catch {
    const lastComplete = cleaned.lastIndexOf('},');
    if (lastComplete > 0) {
      return JSON.parse(cleaned.slice(0, lastComplete + 1) + ']');
    }
    throw new Error('Could not parse AI response');
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured on server' });
  }

  const { base64, mimeType } = req.body;
  if (!base64 || !mimeType) {
    return res.status(400).json({ error: 'Missing base64 or mimeType' });
  }

  try {
    const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
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
        generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: err?.error?.message || `Gemini error ${response.status}`,
      });
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!text) return res.status(500).json({ error: 'Empty response from Gemini' });

    const items = extractJSON(text);
    return res.status(200).json({ items });

  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed to parse receipt' });
  }
};
