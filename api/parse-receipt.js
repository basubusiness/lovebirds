const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'openrouter/free';

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

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured on server' });
  }

  const { base64, mimeType } = req.body;
  if (!base64 || !mimeType) {
    return res.status(400).json({ error: 'Missing base64 or mimeType' });
  }

  try {
    const response = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://lovebirds.vercel.app',
        'X-Title': 'HIRT Household Tracker',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: PROMPT },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64}`,
                },
              },
            ],
          },
        ],
        max_tokens: 1024,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: err?.error?.message || `OpenRouter error ${response.status}`,
      });
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content || '';

    const clean = text.replace(/```json|```/g, '').trim();
    const items = JSON.parse(clean);

    if (!Array.isArray(items)) throw new Error('Unexpected response format');

    return res.status(200).json({ items });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed to parse receipt' });
  }
};
