const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const PROMPT = `Analyze this receipt image and extract all purchased products.

Respond with ONLY a JSON array. Start your response with [ and end with ]. No other text.

Format:
[
  {"name": "Product Name", "quantity": 1, "unit": "pc", "vendorGuess": "StoreName", "confidence": "high"},
  {"name": "Another Product", "quantity": 2, "unit": "kg", "vendorGuess": "StoreName", "confidence": "medium"}
]

Units must be one of: pc, kg, g, L, ml, pack
Confidence must be one of: high, medium, low
Skip discounts, taxes, and totals.
If image is unreadable, respond with exactly: []`;

function extractJSON(text) {
  // Try parsing directly first
  try {
    const direct = JSON.parse(text.trim());
    if (Array.isArray(direct)) return direct;
  } catch {}

  // Strip markdown fences
  let cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();

  // Find [ ... ] boundaries
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1) {
    throw new Error(`No JSON array found. Model returned: ${text.slice(0, 200)}`);
  }

  cleaned = cleaned.slice(start, end + 1);
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

  try {
    return JSON.parse(cleaned);
  } catch {
    // Try recovering truncated response
    const lastComplete = cleaned.lastIndexOf('},');
    if (lastComplete > 0) {
      return JSON.parse(cleaned.slice(0, lastComplete + 1) + ']');
    }
    throw new Error(`Could not parse: ${cleaned.slice(0, 200)}`);
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
        contents: [{
          parts: [
            { text: PROMPT },
            { inline_data: { mime_type: mimeType, data: base64 } },
          ],
        }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
        },
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
