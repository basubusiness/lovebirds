/**
 * parse-receipt.js  (Vercel Serverless Function)
 *
 * Pipeline:
 *   Step 1 — Gemini 2.5 Flash (vision)  → raw item extraction from image
 *   Step 2 — Gemini 2.0 Flash (text)    → translate + normalise + match
 *
 * Both steps use the same GEMINI_API_KEY — no OpenRouter needed.
 */

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const GEMINI_TEXT_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const RETRY_BASE_MS = 300;
const VALID_UNITS = ['pc', 'kg', 'g', 'L', 'ml', 'pack'];
const VALID_CONFIDENCE = ['high', 'medium', 'low'];

// ─── Step 1 Prompt ───────────────────────────────────────────────────────────

const EXTRACT_PROMPT = `Analyze this receipt image and extract all purchased products.

Respond with ONLY a JSON array. Start your response with [ and end with ]. No other text.

Format:
[
  {"name": "exact name from receipt", "quantity": 1, "unit": "pc", "vendorGuess": "StoreName"}
]

Rules:
- Units must be one of: pc, kg, g, L, ml, pack
- quantity must be a positive number
- Skip discounts, taxes, delivery fees, totals, loyalty points
- If image is unreadable, respond with exactly: []`;

// ─── Step 2 Prompt ───────────────────────────────────────────────────────────

function buildNormalizePrompt(rawItems, existingProducts) {
  const productList = existingProducts.length
    ? existingProducts.map(p => `{"id":"${p.id}","name":"${p.name}","unit":"${p.unit}"}`).join('\n')
    : '(none)';

  return `You are a household inventory assistant for a family in Luxembourg.
Receipts may be in French, German, or Luxembourgish.

INPUT ITEMS (from receipt):
${JSON.stringify(rawItems)}

EXISTING INVENTORY (for matching):
${productList}

Your task: for each input item, return a JSON object with these exact fields:
- "name"          : original name (unchanged)
- "nameEn"        : English translation (short and clear)
- "nameCanonical" : clean canonical name e.g. "Whole Milk 1L" not "LAIT ENTIER UHT 1L COLIS"
- "quantity"      : original quantity (unchanged)
- "unit"          : one of: pc kg g L ml pack
- "vendorGuess"   : store name (unchanged)
- "matchedId"     : id from EXISTING INVENTORY if this is the same product, else null
- "confidence"    : "high", "medium", or "low"

Return ONLY a JSON object: {"items": [ ... ]}
No markdown, no explanation, just the JSON.`;
}

// ─── JSON Extraction ─────────────────────────────────────────────────────────

function extractItems(text) {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end   = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error(`No JSON found: ${cleaned.slice(0, 200)}`);
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  }
  if (parsed && Array.isArray(parsed.items)) return parsed.items;
  if (Array.isArray(parsed)) return parsed;
  throw new Error(`Unexpected response shape: ${cleaned.slice(0, 200)}`);
}

function extractJSONArray(text) {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  const start = cleaned.indexOf('[');
  const end   = cleaned.lastIndexOf(']');
  if (start === -1) throw new Error(`No JSON array found: ${cleaned.slice(0, 200)}`);
  const slice = cleaned.slice(start, end + 1);
  const fixed = slice.replace(/,\s*([}\]])/g, '$1');
  try { return JSON.parse(fixed); } catch {}
  const lastBrace = fixed.lastIndexOf('},');
  if (lastBrace > 0) {
    try { return JSON.parse(fixed.slice(0, lastBrace + 1) + ']'); } catch {}
  }
  throw new Error(`Could not parse array: ${slice.slice(0, 200)}`);
}

// ─── Validation ───────────────────────────────────────────────────────────────

function sanitizeItems(items, rawItems) {
  return items.map((item, i) => {
    const raw = rawItems[i] || {};
    return {
      name:          String(item.name          ?? raw.name ?? '(unknown)'),
      nameEn:        String(item.nameEn        ?? item.name ?? raw.name ?? ''),
      nameCanonical: String(item.nameCanonical ?? item.nameEn ?? item.name ?? raw.name ?? ''),
      quantity:      Number(item.quantity      ?? raw.quantity ?? 1) || 1,
      unit:          VALID_UNITS.includes(item.unit) ? item.unit : (raw.unit || 'pc'),
      vendorGuess:   String(item.vendorGuess   ?? raw.vendorGuess ?? ''),
      matchedId:     item.matchedId ?? null,
      confidence:    VALID_CONFIDENCE.includes(item.confidence) ? item.confidence : 'low',
    };
  });
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithTimeout(url, options, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error(`Request timed out after ${timeoutMs / 1000}s`);
    throw err;
  }
}

// ─── Step 1: Gemini Vision ────────────────────────────────────────────────────

async function extractFromImage(base64, mimeType, geminiKey) {
  const response = await fetchWithTimeout(
    `${GEMINI_ENDPOINT}?key=${geminiKey}`,
    {
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
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gemini error ${response.status}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!text) throw new Error('Empty response from Gemini vision');
  return extractJSONArray(text);
}

// ─── Step 2: Gemini Text (translate + normalise + match) ─────────────────────

async function normalizeItems(rawItems, existingProducts, geminiKey) {
  const prompt = buildNormalizePrompt(rawItems, existingProducts);

  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await sleep(RETRY_BASE_MS);

    let response;
    try {
      response = await fetchWithTimeout(
        `${GEMINI_TEXT_ENDPOINT}?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0,
              maxOutputTokens: 2048,
              responseMimeType: 'application/json',
            },
          }),
        }
      );
    } catch (err) {
      if (attempt === 1) throw err;
      continue;
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      if (attempt === 1) throw new Error(err?.error?.message || `Gemini text error ${response.status}`);
      continue;
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!text) {
      if (attempt === 1) throw new Error('Empty response from Gemini text');
      continue;
    }

    try {
      const parsed = extractItems(text);
      if (!Array.isArray(parsed) || parsed.length === 0) continue;

      const reconciled = rawItems.map((raw, i) => parsed[i] ?? {
        name: raw.name, nameEn: raw.name, nameCanonical: raw.name,
        quantity: raw.quantity, unit: raw.unit,
        vendorGuess: raw.vendorGuess, matchedId: null, confidence: 'low',
      });

      return sanitizeItems(reconciled, rawItems);
    } catch (parseErr) {
      if (attempt === 1) throw parseErr;
    }
  }

  throw new Error('Gemini text normalization failed after 2 attempts');
}

// ─── Graceful Fallback ────────────────────────────────────────────────────────

function rawItemsAsFallback(rawItems) {
  return rawItems.map(item => ({
    name: item.name, nameEn: item.name, nameCanonical: item.name,
    quantity: item.quantity,
    unit: VALID_UNITS.includes(item.unit) ? item.unit : 'pc',
    vendorGuess: item.vendorGuess || '',
    matchedId: null, confidence: 'low',
  }));
}

// ─── Handler ──────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

  const { base64, mimeType, existingProducts = [] } = req.body;
  if (!base64 || !mimeType) return res.status(400).json({ error: 'Missing base64 or mimeType' });

  let rawItems;
  try {
    rawItems = await extractFromImage(base64, mimeType, geminiKey);
  } catch (e) {
    return res.status(500).json({ error: `Receipt scan failed: ${e.message}` });
  }

  if (rawItems.length === 0) {
    return res.status(200).json({ items: [], warning: 'No items detected in image.' });
  }

  let items;
  let step2Warning = null;
  try {
    items = await normalizeItems(rawItems, existingProducts, geminiKey);
  } catch (e) {
    console.error('[parse-receipt] Step 2 failed:', e.message);
    items = rawItemsAsFallback(rawItems);
    step2Warning = 'Translation unavailable — showing raw receipt text. You can edit names before importing.';
  }

  return res.status(200).json({
    items,
    ...(step2Warning ? { warning: step2Warning } : {}),
  });
};
