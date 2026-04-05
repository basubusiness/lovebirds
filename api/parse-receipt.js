/**
 * parse-receipt.js  (Vercel Serverless Function)
 *
 * Pipeline:
 *   Step 1 — Gemini 2.5 Flash (vision) → raw item extraction from image
 *   Step 2 — Gemini 2.5 Flash (text)   → translate + normalise + match
 *
 * Token optimizations:
 *   - Compact field names in Step 2 response (n/en/c/q/u/v/m/cf vs full names)
 *   - rawItems stripped to only what Step 2 needs (name, quantity, unit, vendorGuess)
 *   - Inventory list stripped to id+name only (unit dropped, rarely needed for matching)
 *   - responseMimeType: json forces compact output, no markdown wrapping
 *   - maxOutputTokens: 8192 (was 2048 — was causing MAX_TOKENS truncation)
 *   - Debug logs removed for production
 */

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const VALID_UNITS      = ['pc', 'kg', 'g', 'L', 'ml', 'pack'];
const VALID_CONFIDENCE = ['high', 'medium', 'low'];

// ─── Step 1 Prompt ───────────────────────────────────────────────────────────

const EXTRACT_PROMPT = `Extract all purchased products from this receipt image.
Return ONLY a JSON array, nothing else.
Format: [{"name":"exact name","quantity":1,"unit":"pc","vendorGuess":"StoreName"}]
Units: pc kg g L ml pack only.
Skip discounts, taxes, fees, totals. If unreadable return [].`;

// ─── Step 2 Prompt ───────────────────────────────────────────────────────────
// Uses short field keys to minimize output tokens:
//   n=name, en=nameEn, c=nameCanonical, q=quantity, u=unit,
//   v=vendorGuess, m=matchedId, cf=confidence

function buildNormalizePrompt(rawItems, inventory) {
  // Strip rawItems to minimum needed fields
  const items = rawItems.map(({ name, quantity, unit, vendorGuess }) =>
    ({ name, quantity, unit, vendorGuess })
  );

  // Strip inventory to id+name only
  const inv = inventory.length
    ? inventory.map(p => `${p.id}:${p.name}`).join('\n')
    : 'none';

  return `Luxembourg household receipt processor. Translate French/German/Luxembourgish to English.

ITEMS: ${JSON.stringify(items)}

INVENTORY:
${inv}

For each item return compact JSON with short keys:
n=original name, en=English translation, c=canonical name (e.g."Whole Milk 1L"), q=quantity, u=unit(pc/kg/g/L/ml/pack), v=vendorGuess, m=inventory id if same product else null, cf=high/medium/low

Return ONLY: {"items":[{"n":"","en":"","c":"","q":1,"u":"pc","v":"","m":null,"cf":"high"}]}`;
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
    if (start === -1 || end === -1) throw new Error(`No JSON: ${cleaned.slice(0, 200)}`);
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  }
  if (parsed?.items && Array.isArray(parsed.items)) return parsed.items;
  if (Array.isArray(parsed)) return parsed;
  throw new Error(`Bad shape: ${cleaned.slice(0, 200)}`);
}

function extractJSONArray(text) {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  try { const p = JSON.parse(cleaned); if (Array.isArray(p)) return p; } catch {}
  const start = cleaned.indexOf('[');
  const end   = cleaned.lastIndexOf(']');
  if (start === -1) throw new Error(`No array: ${cleaned.slice(0, 200)}`);
  const slice = cleaned.slice(start, end + 1).replace(/,\s*([}\]])/g, '$1');
  try { return JSON.parse(slice); } catch {}
  const last = slice.lastIndexOf('},');
  if (last > 0) { try { return JSON.parse(slice.slice(0, last + 1) + ']'); } catch {} }
  throw new Error(`Parse failed: ${slice.slice(0, 200)}`);
}

// ─── Expand short keys → full field names ────────────────────────────────────

function expandItems(compactItems, rawItems) {
  return compactItems.map((item, i) => {
    const raw = rawItems[i] || {};
    // Support both compact keys and full keys (graceful)
    return {
      name:          String(item.n    ?? item.name          ?? raw.name ?? '(unknown)'),
      nameEn:        String(item.en   ?? item.nameEn        ?? item.n ?? raw.name ?? ''),
      nameCanonical: String(item.c    ?? item.nameCanonical ?? item.en ?? item.n ?? raw.name ?? ''),
      quantity:      Number(item.q    ?? item.quantity       ?? raw.quantity ?? 1) || 1,
      unit:          VALID_UNITS.includes(item.u ?? item.unit) ? (item.u ?? item.unit) : (raw.unit || 'pc'),
      vendorGuess:   String(item.v    ?? item.vendorGuess   ?? raw.vendorGuess ?? ''),
      matchedId:     item.m           ?? item.matchedId     ?? null,
      confidence:    VALID_CONFIDENCE.includes(item.cf ?? item.confidence)
                       ? (item.cf ?? item.confidence) : 'low',
    };
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchWithTimeout(url, options, ms = 25000) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error(`Timeout after ${ms / 1000}s`);
    throw err;
  }
}

async function callGemini(geminiKey, body) {
  return fetchWithTimeout(`${GEMINI_ENDPOINT}?key=${geminiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ─── Step 1: Vision ───────────────────────────────────────────────────────────

async function extractFromImage(base64, mimeType, geminiKey) {
  const res = await callGemini(geminiKey, {
    contents: [{ parts: [
      { text: EXTRACT_PROMPT },
      { inline_data: { mime_type: mimeType, data: base64 } },
    ]}],
    generationConfig: { temperature: 0, maxOutputTokens: 2048, responseMimeType: 'application/json' },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gemini vision error ${res.status}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!text) throw new Error('Empty vision response');
  return extractJSONArray(text);
}

// ─── Step 2: Translate + Normalise + Match ────────────────────────────────────

async function normalizeItems(rawItems, inventory, geminiKey) {
  const prompt = buildNormalizePrompt(rawItems, inventory);

  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await sleep(500);

    let res;
    try {
      res = await callGemini(geminiKey, {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 8192, responseMimeType: 'application/json' },
      });
    } catch (err) {
      if (attempt === 1) throw err;
      continue;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (attempt === 1) throw new Error(err?.error?.message || `Gemini text error ${res.status}`);
      continue;
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const reason = data?.candidates?.[0]?.finishReason;

    if (reason === 'MAX_TOKENS') {
      console.warn('[parse-receipt] MAX_TOKENS hit on attempt', attempt);
      if (attempt === 1) throw new Error('Response too long even at 8192 tokens');
      continue;
    }

    if (!text) {
      if (attempt === 1) throw new Error('Empty text response');
      continue;
    }

    try {
      const compact = extractItems(text);
      if (!Array.isArray(compact) || compact.length === 0) continue;

      // Pad if model returned fewer items than input
      const padded = rawItems.map((raw, i) => compact[i] ?? {
        n: raw.name, en: raw.name, c: raw.name,
        q: raw.quantity, u: raw.unit, v: raw.vendorGuess, m: null, cf: 'low',
      });

      return expandItems(padded, rawItems);
    } catch (parseErr) {
      if (attempt === 1) throw parseErr;
    }
  }

  throw new Error('Normalization failed after 2 attempts');
}

// ─── Fallback ─────────────────────────────────────────────────────────────────

function rawFallback(rawItems) {
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
    items = rawFallback(rawItems);
    step2Warning = 'Translation unavailable — showing raw receipt text. You can edit names before importing.';
  }

  return res.status(200).json({
    items,
    ...(step2Warning ? { warning: step2Warning } : {}),
  });
};
