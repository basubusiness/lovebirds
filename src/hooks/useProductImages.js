/**
 * useProductImages.js
 *
 * Fetches product images from Unsplash/Wikipedia and stores on products table.
 * Uses a proper useEffect triggered by products loading — no race condition.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useProductImages(products) {
  // productId → url (starts from whatever is in products.image_url)
  const [imageUrls, setImageUrls] = useState({});

  // Whenever products array changes, seed from DB values and fetch missing
  useEffect(() => {
    if (!products || products.length === 0) return;

    // Seed from already-stored values
    const urls = {};
    for (const p of products) {
      if (p.image_url) urls[p.id] = p.image_url;
    }
    setImageUrls(urls);

    // Fetch missing ones
    const missing = products.filter(p => !p.image_url);
    if (missing.length === 0) return;

    console.log('[IMG] Fetching images for', missing.length, 'products');

    // Fetch sequentially to avoid rate limiting — 1 per 200ms
    let i = 0;
    const fetchNext = async () => {
      if (i >= missing.length) return;
      const p = missing[i++];
      try {
        const res  = await fetch(`/api/fetch-image?q=${encodeURIComponent(p.name + ' food')}`);
        const data = await res.json();
        if (data.url) {
          await supabase.from('products').update({ image_url: data.url }).eq('id', p.id);
          setImageUrls(prev => ({ ...prev, [p.id]: data.url }));
          console.log('[IMG] Got image for', p.name);
        }
      } catch (e) {
        console.warn('[IMG] Failed for', p.name, e.message);
      }
      setTimeout(fetchNext, 200);
    };
    fetchNext();
  // Only re-run when product IDs change (not on every render)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products.map(p => p.id).join(',')]);

  // Allow manual override (user upload via QuickEditModal)
  const setImageUrl = useCallback(async (productId, url) => {
    setImageUrls(prev => ({ ...prev, [productId]: url }));
    await supabase.from('products').update({ image_url: url }).eq('id', productId);
  }, []);

  return { imageUrls, setImageUrl };
}
