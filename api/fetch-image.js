/**
 * api/fetch-image.js
 *
 * Looks up a royalty-free product image from Unsplash.
 * Called once per master item — result is cached in master_items.image_url.
 *
 * GET /api/fetch-image?q=red+onions
 * Returns: { url: "https://images.unsplash.com/..." } or { url: null }
 *
 * Requires: UNSPLASH_ACCESS_KEY in Vercel environment variables.
 * Get a free key at: https://unsplash.com/developers (50 req/hour free)
 */

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const query = req.query.q;
  if (!query) return res.status(400).json({ error: 'Missing q param' });

  const key = process.env.UNSPLASH_ACCESS_KEY;

  try {
    // ── Try Unsplash first (if key is configured) ──────────────────
    if (key) {
      const searchUrl = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=3&orientation=landscape&client_id=${key}`;
      const response  = await fetch(searchUrl);

      if (response.ok) {
        const data    = await response.json();
        const results = data?.results ?? [];
        const url     = results[0]?.urls?.small ?? null;
        if (url) {
          res.setHeader('Cache-Control', 'public, max-age=86400');
          return res.status(200).json({ url, source: 'unsplash' });
        }
      } else {
        console.error('[fetch-image] Unsplash error:', response.status);
      }
    }

    // ── Fallback: Wikimedia Commons (free, no key needed) ──────────
    // Uses the Wikimedia API to find a representative food image
    const wikiQuery   = query.replace(/ food$/i, '').trim();
    const wikiUrl     = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiQuery)}`;
    const wikiRes     = await fetch(wikiUrl, {
      headers: { 'User-Agent': 'HIRT-household-app/1.0' }
    });
    if (wikiRes.ok) {
      const wikiData = await wikiRes.json();
      const url      = wikiData?.thumbnail?.source ?? wikiData?.originalimage?.source ?? null;
      if (url) {
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.status(200).json({ url, source: 'wikipedia' });
      }
    }

    return res.status(200).json({ url: null });
  } catch (e) {
    console.error('[fetch-image] error:', e.message);
    return res.status(200).json({ url: null });
  }
};
