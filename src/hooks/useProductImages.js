/**
 * useProductImages.js
 *
 * Fetches product images from Unsplash/Wikipedia and stores them
 * directly on the user-owned products table (not master_items).
 *
 * Why products and not master_items:
 *   Seed master_items have user_id = null so RLS blocks updates.
 *   products are fully user-owned — no RLS issues.
 *
 * Returns: imageUrls map { productId → url }
 * Call fetchMissing(products) after products load to populate.
 */

import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useProductImages() {
  const [imageUrls, setImageUrls] = useState({}); // productId → url

  // Seed from already-fetched products (call once after products load)
  const seedFromProducts = useCallback((products) => {
    const urls = {};
    for (const p of products) {
      if (p.image_url) urls[p.id] = p.image_url;
    }
    setImageUrls(urls);
  }, []);

  // Fetch images for products that don't have one yet
  const fetchMissing = useCallback(async (products) => {
    const missing = products.filter(p => !p.image_url).slice(0, 15);
    if (missing.length === 0) return;

    console.log('[IMG] Fetching images for', missing.length, 'products:', missing.map(p => p.name));

    for (const p of missing) {
      try {
        const res  = await fetch(`/api/fetch-image?q=${encodeURIComponent(p.name + ' food')}`);
        const data = await res.json();
        if (data.url) {
          // Save to products table (user-owned — RLS allows this)
          await supabase
            .from('products')
            .update({ image_url: data.url })
            .eq('id', p.id);

          setImageUrls(prev => ({ ...prev, [p.id]: data.url }));
          console.log('[IMG] Saved image for product', p.name);
        }
      } catch (e) {
        console.warn('[IMG] Failed for', p.name, e.message);
      }
    }
  }, []);

  // Allow manual set (for user uploads via QuickEditModal)
  const setImageUrl = useCallback((productId, url) => {
    setImageUrls(prev => ({ ...prev, [productId]: url }));
  }, []);

  return { imageUrls, seedFromProducts, fetchMissing, setImageUrl };
}
