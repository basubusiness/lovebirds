/**
 * matcher.js
 *
 * Client-side fuzzy matching of receipt items against existing inventory.
 * Runs entirely in the browser — no API call needed.
 *
 * Strategy (in order of priority):
 *   1. Exact matchedId from Step 2 API  (if Step 2 succeeded)
 *   2. Exact name match (case-insensitive, after normalisation)
 *   3. Substring containment bonus — one name fully contained in the other
 *      e.g. "rice" ↔ "basmati rice" scores high even though Jaccard is low
 *   4. Normalised token-overlap (Jaccard) with light stemming
 *   5. No match → null
 *
 * Thresholds:
 *   MATCH_THRESHOLD  0.55  — base Jaccard cutoff (was 0.65, relaxed because
 *                            containment bonus now handles generic→specific)
 *   CONTAIN_BONUS    0.25  — added when one token-set is a subset of the other
 *   Combined score must reach 0.65 to confirm a match.
 */

const MATCH_THRESHOLD = 0.55;
const CONTAIN_BONUS   = 0.25;
const CONFIRM_SCORE   = 0.65;

// Common words to ignore (grocery stop words)
const STOP_WORDS = new Set([
  // French
  'de', 'du', 'des', 'le', 'la', 'les', 'un', 'une', 'au', 'aux',
  // English
  'the', 'a', 'an', 'and', 'with', 'of',
  // German / Luxembourgish
  'von', 'mit', 'der', 'die', 'das',
  // Generic grocery qualifiers that shouldn't drive matching
  'bio', 'organic', 'natural', 'premium', 'fresh', 'extra',
]);

// Very light stemming: strip common suffixes so "tablets" matches "tablet",
// "tomatoes" matches "tomato", "fillets" matches "fillet", etc.
function stem(token) {
  return token
    .replace(/ies$/, 'y')    // berries → berry
    .replace(/oes$/, 'o')    // tomatoes → tomato
    .replace(/es$/, '')      // tablets → tablet, fillets → fillet
    .replace(/s$/, '');      // items → item (runs after the above)
}

/**
 * Normalise a product name for comparison:
 * - lowercase
 * - remove punctuation and units
 * - split into tokens
 * - remove stop words
 * - apply light stemming
 */
function tokenize(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')               // remove punctuation
    .replace(/\b\d+\s*(ml|g|kg|l|cl|pc|pack|x)\b/g, '') // remove qty+unit combos
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOP_WORDS.has(t))
    .map(stem);
}

/**
 * Jaccard similarity between two token sets.
 */
function jaccard(tokensA, tokensB) {
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  const intersection = [...setA].filter(t => setB.has(t)).length;
  const union = new Set([...setA, ...setB]).size;
  return intersection / union;
}

/**
 * Containment bonus: returns CONTAIN_BONUS if every token in the smaller
 * set appears in the larger set (one is a semantic subset of the other).
 *
 * "rice" (1 token) ⊂ "basmati rice" (2 tokens) → bonus
 * "whole milk" (2 tokens) ⊂ "whole milk 1l" (3 tokens) → bonus
 */
function containmentBonus(tokensA, tokensB) {
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  const [smaller, larger] = tokensA.length <= tokensB.length
    ? [tokensA, tokensB]
    : [tokensB, tokensA];
  const largeSet = new Set(larger);
  const allIn = smaller.every(t => largeSet.has(t));
  return allIn ? CONTAIN_BONUS : 0;
}

/**
 * Combined score for one pair of names.
 */
function score(tokensA, tokensB) {
  return jaccard(tokensA, tokensB) + containmentBonus(tokensA, tokensB);
}

/**
 * Find the best matching inventory product for a receipt item name.
 * Checks both the canonical name and the English name.
 *
 * @param {string} nameCanonical  - normalised name from Step 2
 * @param {string} nameEn         - English translation from Step 2
 * @param {Array}  products       - existing inventory products
 * @returns {{ product, score } | null}
 */
function findBestMatch(nameCanonical, nameEn, products) {
  const queryNames    = [nameCanonical, nameEn].filter(Boolean);
  const queryTokenSets = queryNames.map(tokenize);

  let best      = null;
  let bestScore = 0;

  for (const product of products) {
    const productTokens = tokenize(product.name);

    for (const queryTokens of queryTokenSets) {
      // Exact match (normalised)
      if (
        product.name.toLowerCase().trim() === nameCanonical?.toLowerCase().trim() ||
        product.name.toLowerCase().trim() === nameEn?.toLowerCase().trim()
      ) {
        return { product, score: 1.0 };
      }

      const combined = score(queryTokens, productTokens);
      if (combined > bestScore) {
        bestScore = combined;
        best      = product;
      }
    }
  }

  // Only return a match if above the Jaccard floor AND combined score confirms
  const baseJaccard = queryTokenSets.reduce((max, qt) => {
    const j = jaccard(qt, tokenize(best?.name ?? ''));
    return j > max ? j : max;
  }, 0);

  if (bestScore >= CONFIRM_SCORE && baseJaccard >= MATCH_THRESHOLD) {
    return { product: best, score: bestScore };
  }

  return null;
}

/**
 * Main export: enrich a list of parsed receipt items with client-side matching.
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
        matchedId:  result.product.id,
      };
    }

    return { ...item, matched: null, matchScore: 0 };
  });
}
