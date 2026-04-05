/**
 * parse-receipt.js  (Vercel Serverless Function)
 *
 * Pipeline:
 *   Step 1 — Gemini 2.5 Flash (vision)   → raw item extraction from image
 *   Step 2 — Gemini Flash 8B via OpenRouter → translate + normalise + match
 *             (falls back through a model chain if provider errors occur)
 *
 * Root cause of "Provider returned error":
 *   Llama 3.3 70B :free on OpenRouter has very high 503/overloaded rates,
 *   especially outside US business hours. The fix is to use models with
 *   better free-tier availability. Model priority chain:
 *     1. google/gemini-flash-1.5-8b        (free, fast, great JSON, high uptime)
 *     2. mistralai/mistral-7b-instruct:free (reliable fallback, good JSON)
 *     3. meta-llama/llama-3.1-8b-instruct:free (last resort, smaller = faster queue)
 *
 * Other fixes:
 *   • Retries up to MAX_RETRIES, cycling through the model chain on 503/429
 *   • JSONL-style prompt — one object per line, partial responses still parse
 *   • extractJSONLines() recovers incomplete arrays line by line
 *   • System message anchors JSON-only output
 *   • Temperature 0 for maximum determinism
 *   • Graceful fallback: returns raw Gemini items + warning banner if all fails
 *   • Full error message surfaced (includes provider error body) for debugging
 */

// ─── Constants ───────────────────────────────────────────────────────────────

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

// Model chain: tried in order. On 503/429 we advance to the next model.
// All are free-tier on OpenRouter; gemini-flash-8b has the highest availability.
const NORMALIZE_MODELS = [
  'google/gemini-2.0-flash-exp:free',          // primary: free, fast, great French→English
  'mistralai/mistral-small-3.1-24b-instruct:free', // fallback 1: French company, great translation
  'meta-llama/llama-3.1-8b-instruct:free',     // fallback 2: last resort
];

// Keep these aliases so the rest of the file compiles unchanged
const NORMALIZE_MODEL          = NORMALIZE_MODELS[0];
const NORMALIZE_MODEL_FALLBACK = NORMALIZE_MODELS[1];

const RETRY_BASE_MS = 800; // ms between attempts; multiplied by (modelIdx + attempt)

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

const NORMALIZE_SYSTEM = `You are a JSON-only API. You never output prose, markdown, or explanation.
Every response must be a raw JSON array starting with [ and ending with ].
You process household grocery receipts for a family in Luxembourg.`;

function buildNormalizePrompt(rawItems, existingProducts) {
  const productList = existingProducts.length
    ? existingProducts.map(p => `{"id":"${p.id}","name":"${p.name}","unit":"${p.unit}"}`).join('\n')
    : '(none)';

  // We ask for one JSON object per line (JSONL-style inside an array).
  // This makes partial responses recoverable — each complete line is valid.
  return `Process these receipt items for a Luxembourg household.
Receipts may be in French, German, or Luxembourgish.

INPUT ITEMS:
${JSON.stringify(rawItems)}

EXISTING INVENTORY (for matching):
${productList}

OUTPUT RULES — extremely important:
1. Return a JSON array: one object per item, one object per line.
2. No markdown. No backticks. No explanation. Raw JSON only.
3. Each object must have EXACTLY these fields:
   - "name"          : original name string (unchanged)
   - "nameEn"        : English translation (short, clear)
   - "nameCanonical" : clean display name e.g. "Whole Milk 1L" not "LAIT ENTIER UHT 1L COLIS"
   - "quantity"      : original quantity number (unchanged)
   - "unit"          : one of: pc kg g L ml pack
   - "vendorGuess"   : store name string (unchanged)
   - "matchedId"     : id string from EXISTING INVENTORY if same product, else null
   - "confidence"    : "high" | "medium" | "low" (match confidence if matched, else translation confidence)

Example of correct output for 2 items:
[
{"name":"LAIT ENTIER 1L","nameEn":"Whole Milk","nameCanonical":"Whole Milk 1L","quantity":2,"unit":"L","vendorGuess":"Cactus","matchedId":null,"confidence":"high"},
{"name":"DISHWASHER TABS 30PC","nameEn":"Dishwasher Tablets","nameCanonical":"Dishwasher Tabs 30pc","quantity":1,"unit":"pack","vendorGuess":"Cactus","matchedId":"p3","confidence":"high"}
]

Now process the INPUT ITEMS above. Output only the JSON array, nothing else.`;
}

// ─── JSON Extraction ─────────────────────────────────────────────────────────

/**
 * Primary extractor: parse JSONL-style (one object per line inside an array).
 * Collects every line that is a valid JSON object, so partial responses work.
 */
function extractJSONLines(text) {
  const results = [];
  // Strip optional array brackets and markdown fences
  const cleaned = text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim()
    .replace(/^\[/, '')
    .replace(/\]$/, '');

  for (const raw of cleaned.split('\n')) {
    const line = raw.trim().replace(/,\s*$/, ''); // strip trailing comma
    if (!line || line === '[' || line === ']') continue;
    try {
      const obj = JSON.parse(line);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        results.push(obj);
      }
    } catch {
      // skip unparseable lines
    }
  }

  if (results.length > 0) return results;

  // Fallback: try the whole text as a standard JSON array
  return extractJSONArray(text);
}

/**
 * Fallback extractor: find the outermost [ … ] and parse it,
 * attempting to recover truncated arrays by closing them.
 */
function extractJSONArray(text) {
  let cleaned = text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  // Direct parse
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
  } catch {}

  // Slice to outermost array
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1) {
    throw new Error(`No JSON array found. Model returned: ${text.slice(0, 400)}`);
  }

  const slice = end !== -1 ? cleaned.slice(start, end + 1) : cleaned.slice(start);

  // Remove trailing commas
  const fixed = slice.replace(/,\s*([}\]])/g, '$1');

  try {
    return JSON.parse(fixed);
  } catch {
    // Try recovering complete objects from a truncated array
    const lastBrace = fixed.lastIndexOf('},');
    if (lastBrace > 0) {
      try {
        return JSON.parse(fixed.slice(0, lastBrace + 1) + ']');
      } catch {}
    }
    throw new Error(`Could not parse Step 2 response: ${slice.slice(0, 400)}`);
  }
}

// ─── Validation & Sanitisation ───────────────────────────────────────────────

/**
 * Ensure each item has all required fields with sensible defaults.
 * Never throws — bad items get defaults rather than crashing the whole batch.
 */
function sanitizeItems(items, rawItems) {
  return items.map((item, i) => {
    const raw = rawItems[i] || {};
    return {
      name: String(item.name ?? raw.name ?? '(unknown)'),
      nameEn: String(item.nameEn ?? item.name ?? raw.name ?? ''),
      nameCanonical: String(item.nameCanonical ?? item.nameEn ?? item.name ?? raw.name ?? ''),
      quantity: Number(item.quantity ?? raw.quantity ?? 1) || 1,
      unit: VALID_UNITS.includes(item.unit) ? item.unit : (raw.unit || 'pc'),
      vendorGuess: String(item.vendorGuess ?? raw.vendorGuess ?? ''),
      matchedId: item.matchedId ?? null,
      confidence: VALID_CONFIDENCE.includes(item.confidence) ? item.confidence : 'low',
    };
  });
}

// ─── Sleep helper ─────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ─── Step 1: Gemini Vision ────────────────────────────────────────────────────

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

  return extractJSONArray(text);
}

// ─── Step 2: Llama Normalization (with retries) ───────────────────────────────

async function normalizeItems(rawItems, existingProducts, openrouterKey) {
  const prompt = buildNormalizePrompt(rawItems, existingProducts);
  let lastError = null;

  // We iterate over (model, attempt) pairs so provider errors advance the model,
  // while transient errors (empty response, JSON parse) retry the same model once.
  for (let modelIdx = 0; modelIdx < NORMALIZE_MODELS.length; modelIdx++) {
    const useModel = NORMALIZE_MODELS[modelIdx];
    const attemptsForModel = modelIdx === 0 ? 2 : 1; // retry primary once, others once

    for (let attempt = 0; attempt < attemptsForModel; attempt++) {
      if (modelIdx > 0 || attempt > 0) {
        const delay = RETRY_BASE_MS * (modelIdx + attempt);
        console.log(
          `[parse-receipt] Step 2 — model ${modelIdx + 1}/${NORMALIZE_MODELS.length}` +
          ` (${useModel}), attempt ${attempt + 1}, waiting ${delay}ms`
        );
        await sleep(delay);
      }

      let response;
      try {
        response = await fetch(OPENROUTER_ENDPOINT, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openrouterKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://lovebirds.vercel.app',
            'X-Title': 'HIRT Household Tracker',
          },
          body: JSON.stringify({
            model: useModel,
            messages: [
              { role: 'system', content: NORMALIZE_SYSTEM },
              { role: 'user',   content: prompt },
            ],
            max_tokens: 2048,
            temperature: 0,
            top_p: 1,
          }),
        });
      } catch (networkErr) {
        // Fetch-level failure (DNS, timeout) — try next model immediately
        lastError = networkErr;
        break; // break inner loop → advance modelIdx
      }

      // Provider error (503 overloaded, 429 rate-limit) → advance to next model
      if (response.status === 503 || response.status === 429) {
        const errBody = await response.json().catch(() => ({}));
        const providerMsg = errBody?.error?.message || errBody?.error || `HTTP ${response.status}`;
        lastError = new Error(`Provider error [${useModel}]: ${providerMsg}`);
        console.warn(`[parse-receipt] ${lastError.message} — trying next model`);
        break; // break inner loop → advance modelIdx
      }

      // Other HTTP errors (auth, bad request) → hard fail, no point retrying
      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody?.error?.message || `OpenRouter error ${response.status}`);
      }

      const data = await response.json();
      const text = data?.choices?.[0]?.message?.content || '';

      if (!text) {
        lastError = new Error(`Empty response from ${useModel}`);
        continue; // retry same model
      }

      // Parse — try JSONL first (recovers partial responses), then standard array
      let parsed;
      try {
        parsed = extractJSONLines(text);
      } catch (parseErr) {
        lastError = parseErr;
        continue; // retry same model
      }

      if (!Array.isArray(parsed) || parsed.length === 0) {
        lastError = new Error(`Step 2 returned empty array from ${useModel}. Raw: ${text.slice(0, 300)}`);
        continue; // retry same model
      }

      // Reconcile: if model returned fewer items than input, pad with safe defaults
      const reconciled = rawItems.map((raw, i) => parsed[i] ?? {
        name:          raw.name,
        nameEn:        raw.name,
        nameCanonical: raw.name,
        quantity:      raw.quantity,
        unit:          raw.unit,
        vendorGuess:   raw.vendorGuess,
        matchedId:     null,
        confidence:    'low',
      });

      return sanitizeItems(reconciled, rawItems);
    }
  }

  // All models exhausted
  throw new Error(
    `Step 2 normalization failed (tried all ${NORMALIZE_MODELS.length} models). ` +
    `Last error: ${lastError?.message}`
  );
}

// ─── Graceful Fallback ────────────────────────────────────────────────────────

/**
 * If Step 2 fails completely, return Step 1 raw items with minimal defaults
 * so the user still gets a reviewable list rather than a hard error.
 */
function rawItemsAsFallback(rawItems) {
  return rawItems.map(item => ({
    name: item.name,
    nameEn: item.name,          // untranslated — user can edit
    nameCanonical: item.name,
    quantity: item.quantity,
    unit: VALID_UNITS.includes(item.unit) ? item.unit : 'pc',
    vendorGuess: item.vendorGuess || '',
    matchedId: null,
    confidence: 'low',
  }));
}

// ─── Handler ──────────────────────────────────────────────────────────────────

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

  // Step 1: vision extraction (no fallback — if Gemini fails, nothing to show)
  let rawItems;
  try {
    rawItems = await extractFromImage(base64, mimeType, geminiKey);
  } catch (e) {
    return res.status(500).json({ error: `Receipt scan failed: ${e.message}` });
  }

  if (rawItems.length === 0) {
    return res.status(200).json({ items: [], warning: 'No items detected in image.' });
  }

  // Step 2: normalise + translate + match (with graceful fallback)
  let items;
  let step2Warning = null;
  try {
    items = await normalizeItems(rawItems, existingProducts, openrouterKey);
  } catch (e) {
    console.error('[parse-receipt] Step 2 failed, using raw fallback:', e.message);
    items = rawItemsAsFallback(rawItems);
    step2Warning = 'Translation service unavailable — showing raw receipt text. You can edit names before importing.';
  }

  return res.status(200).json({
    items,
    ...(step2Warning ? { warning: step2Warning } : {}),
  });
};
