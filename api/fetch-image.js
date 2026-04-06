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
  if (!key) {
    // Graceful degradation — no key configured, return null
    return res.status(200).json({ url: null });
  }

  try {
    const searchUrl = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=3&orientation=landscape&client_id=${key}`;
    const response  = await fetch(searchUrl);

    if (!response.ok) {
      console.error('[fetch-image] Unsplash error:', response.status);
      return res.status(200).json({ url: null });
    }

    const data    = await response.json();
    const results = data?.results ?? [];

    if (results.length === 0) {
      return res.status(200).json({ url: null });
    }

    // Prefer food/product images — pick the first result
    // Use the 'small' size (400px wide) — fast to load, good enough for cards
    const url = results[0]?.urls?.small ?? null;

    // Cache headers — images don't change often
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).json({ url });
  } catch (e) {
    console.error('[fetch-image] error:', e.message);
    return res.status(200).json({ url: null });
  }
};
