const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const NORMALIZE_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';

// Step 1 prompt: pure extraction, no translation
const EXTRACT_PROMPT = `Analyze this receipt image and extract all purchased products.

Respond with ONLY a JSON array. Start your response with [ and end with ]. No other text.

Format:
[
  {"name": "exact name from receipt", "quantity": 1, "unit": "pc", "vendorGuess": "StoreName"}
]

Units must be one of: pc, kg, g, L, ml, pack
Skip discounts, taxes, delivery fees, and totals.
If image is unreadable, respond with exactly: []`;

// Step 2 prompt: normalize, translate, match
function buildNormalizePrompt(rawItems, existingProducts) {
  const productList = existingProducts
    .map(p => `- "${p.name}" (id: ${p.id}, unit: ${p.unit})`)
    .join('\n');

  return `You are a household inventory assistant for a family in Luxembourg.
They shop at stores like Luxcaddy, efarmz, Cactus, Amazon.de, Biobus, Naturata.
Products may appear in French, German, or Luxembourgish on receipts.

Here are the items just scanned from a receipt:
${JSON.stringify(rawItems, null, 2)}

Here are the products already in their inventory:
${productList || '(none yet)'}

Your tasks for each scanned item:
1. Translate "name" to English as "nameEn"
2. Normalize to a clean canonical name as "nameCanonical" (e.g. "Whole Milk 1L" not "LAIT ENTIER UHT 1L COLIS")
3. If it matches an existing inventory product (same thing, different store name), set "matchedId" to that product's id. Otherwise null.
4. Set "confidence" to "high", "medium", or "low" based on how sure you are of the match
5. Keep original "name", "quantity", "unit", "vendorGuess" unchanged

Return ONLY a JSON array with these fields per item:
name, nameEn, nameCanonical, quantity, unit, vendorGuess, matchedId, confidence

No markdown, no explanation. Just the JSON array.`;
}

function extractJSON(text) {
  try {
    const direct = JSON.parse(text.trim());
    if (Array.isArray(direct)) return direct;
  } catch {}

  let cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1) {
    throw new Error(`No JSON array found. Model returned: ${text.slice(0, 300)}`);
  }
  cleaned = cleaned.slice(start, end + 1);
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
  try {
    return JSON.parse(cleaned);
  } catch {
    const lastComplete = cleaned.lastIndexOf('},');
    if (lastComplete > 0) {
      return JSON.parse(cleaned.slice(0, lastComplete + 1) + ']');
    }
    throw new Error(`Could not parse response: ${cleaned.slice(0, 300)}`);
  }
}

// Step 1: Gemini vision extraction
async function extractFromImage(base64, mimeType, geminiKey) {
  const response = await fetch(`${GEMINI_ENDPOINT}?key=${geminiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: EXTRACT_PROMPT },
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
    throw new Error(err?.error?.message || `Gemini error ${response.status}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!text) throw new Error('Empty response from Gemini');
  return extractJSON(text);
}

// Step 2: Llama normalization + translation + matching
async function normalizeItems(rawItems, existingProducts, openrouterKey) {
  const response = await fetch(OPENROUTER_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openrouterKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://lovebirds.vercel.app',
      'X-Title': 'HIRT Household Tracker',
    },
    body: JSON.stringify({
      model: NORMALIZE_MODEL,
      messages: [{
        role: 'user',
        content: buildNormalizePrompt(rawItems, existingProducts),
      }],
      max_tokens: 2048,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `OpenRouter error ${response.status}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content || '';
  if (!text) throw new Error('Empty response from normalization model');
  return extractJSON(text);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const geminiKey     = process.env.GEMINI_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;

  if (!geminiKey)     return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  if (!openrouterKey) return res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' });

  const { base64, mimeType, existingProducts = [] } = req.body;
  if (!base64 || !mimeType) {
    return res.status(400).json({ error: 'Missing base64 or mimeType' });
  }

  try {
    // Step 1: Extract raw items from image
    const rawItems = await extractFromImage(base64, mimeType, geminiKey);

    if (rawItems.length === 0) {
      return res.status(200).json({ items: [] });
    }

    // Step 2: Normalize, translate, match against inventory
    const items = await normalizeItems(rawItems, existingProducts, openrouterKey);

    return res.status(200).json({ items });

  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed to parse receipt' });
  }
};
