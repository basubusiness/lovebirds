/**
 * matcher.js
 *
 * Client-side fuzzy matching of receipt items against existing inventory.
 * Runs entirely in the browser — no API call needed.
 *
 * Strategy (in order of priority):
 *   1. Exact matchedId from Step 2 API  (if Step 2 succeeded)
 *   2. Exact name match (case-insensitive)
 *   3. Normalized token overlap score  (handles word order, plurals, abbreviations)
 *   4. No match → null
 *
 * Threshold: 0.65 (65% token overlap) — tuned for grocery items like
 * "Whole Milk 1L" vs "Whole Milk", "Dishwasher Tabs" vs "Dishwasher Tablets"
 */

const MATCH_THRESHOLD = 0.65;

// Common words to ignore when comparing (stop words for grocery context)
const STOP_WORDS = new Set([
  'de', 'du', 'des', 'le', 'la', 'les', 'un', 'une',  // French
  'bio', 'organic', 'natural', 'premium', 'fresh',       // Generic qualifiers
  'the', 'a', 'an', 'and', 'with', 'von', 'mit',        // English/German
]);

/**
 * Normalize a product name for comparison:
 * - lowercase
 * - remove punctuation and units
 * - split into tokens
 * - remove stop words
 */
function tokenize(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')   // remove punctuation
    .replace(/\b\d+\s*(ml|g|kg|l|cl|pc|pack|x)\b/g, '') // remove quantities
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOP_WORDS.has(t));
}

/**
 * Jaccard similarity between two token sets.
 * Returns 0–1 where 1 = identical.
 */
function similarity(tokensA, tokensB) {
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  const intersection = [...setA].filter(t => setB.has(t)).length;
  const union = new Set([...setA, ...setB]).size;
  return intersection / union;
}

/**
 * Find the best matching inventory product for a receipt item name.
 * Checks both the canonical name and the English name.
 *
 * @param {string} nameCanonical  - normalized name from Step 2 (e.g. "Whole Milk 1L")
 * @param {string} nameEn         - English translation from Step 2 (e.g. "Whole Milk")
 * @param {Array}  products       - existing inventory products
 * @returns {{ product, score } | null}
 */
function findBestMatch(nameCanonical, nameEn, products) {
  const queryNames = [nameCanonical, nameEn].filter(Boolean);
  const queryTokenSets = queryNames.map(tokenize);

  let best = null;
  let bestScore = 0;

  for (const product of products) {
    const productTokens = tokenize(product.name);

    for (const queryTokens of queryTokenSets) {
      // Exact match (after normalization)
      if (
        product.name.toLowerCase().trim() === nameCanonical?.toLowerCase().trim() ||
        product.name.toLowerCase().trim() === nameEn?.toLowerCase().trim()
      ) {
        return { product, score: 1.0 };
      }

      const score = similarity(queryTokens, productTokens);
      if (score > bestScore) {
        bestScore = score;
        best = product;
      }
    }
  }

  if (bestScore >= MATCH_THRESHOLD) {
    return { product: best, score: bestScore };
  }

  return null;
}

/**
 * Main export: enrich a list of parsed receipt items with client-side matching.
 *
 * For each item:
 *   - If Step 2 already provided a valid matchedId → keep it (trust the API)
 *   - Otherwise → run client-side fuzzy match
 *   - Attach matched product and score to the item
 *
 * @param {Array} items     - parsed items from API (after Step 2)
 * @param {Array} products  - existing inventory products
 * @returns {Array}         - enriched items with `matched` and `matchScore` fields
 */
export function enrichWithMatches(items, products) {
  return items.map(item => {
    // Step 2 already matched it — verify the id still exists
    if (item.matchedId) {
      const apiMatch = products.find(p => p.id === item.matchedId);
      if (apiMatch) {
        return { ...item, matched: apiMatch, matchScore: 1.0 };
      }
    }

    // Client-side fuzzy match
    const result = findBestMatch(item.nameCanonical, item.nameEn, products);

    if (result) {
      return {
        ...item,
        matched:    result.product,
        matchScore: result.score,
        matchedId:  result.product.id,  // backfill so confirm logic works
      };
    }

    return { ...item, matched: null, matchScore: 0 };
  });
}
