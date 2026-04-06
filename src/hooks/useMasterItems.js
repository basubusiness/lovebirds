/**
 * useMasterItems.js
 *
 * Fetches master_items (seed + own) and provides add/update/delete.
 * Cached module-level for the session (seed data never changes mid-session).
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

let _cache = null;

export function useMasterItems() {
  const [items,     setItems]     = useState(_cache || []);
  const [loading,   setLoading]   = useState(!_cache);
  const [userId,    setUserId]    = useState(null);
  const [imageUrls, setImageUrls] = useState({}); // masterItemId → url

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data?.user?.id ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setUserId(s?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (_cache) return;
    if (!userId) return;
    supabase
      .from('master_items')
      .select('*')
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error('[useMasterItems] fetch:', error);
        const loaded = data ?? [];
        _cache = loaded;
        setItems(loaded);
        setLoading(false);
        // Populate imageUrls from cached DB values immediately
        const urls = {};
        for (const m of loaded) {
          if (m.image_url) urls[m.id] = m.image_url;
        }
        setImageUrls(urls);
        // Eagerly fetch images for items without one (fire-and-forget, limit to 20)
        const missing = loaded.filter(m => !m.image_url).slice(0, 20);
        missing.forEach(async (m) => {
          try {
            const res  = await fetch(`/api/fetch-image?q=${encodeURIComponent(m.name + ' food')}`);
            const data = await res.json();
            if (data.url) {
              setImageUrls(prev => ({ ...prev, [m.id]: data.url }));
              await supabase.from('master_items').update({ image_url: data.url }).eq('id', m.id);
              // Update cache
              _cache = _cache.map(x => x.id === m.id ? { ...x, image_url: data.url } : x);
            }
          } catch {}
        });
      });
  }, [userId]);

  const addMasterItem = useCallback(async (item) => {
    if (!userId) return null;
    const { data, error } = await supabase
      .from('master_items')
      .insert({ ...item, user_id: userId })
      .select()
      .single();
    if (error) { console.error('[useMasterItems] insert:', error); return null; }
    _cache = [...(items), data];
    setItems(_cache);
    return data;
  }, [userId, items]);

  const updateMasterItem = useCallback(async (id, patch) => {
    const { data, error } = await supabase
      .from('master_items')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) { console.error('[useMasterItems] update:', error); return null; }
    const next = items.map(i => i.id === id ? data : i);
    _cache = next;
    setItems(next);
    return data;
  }, [items]);

  const deleteMasterItem = useCallback(async (id) => {
    const { error } = await supabase
      .from('master_items')
      .delete()
      .eq('id', id);
    if (error) { console.error('[useMasterItems] delete:', error); return false; }
    const next = items.filter(i => i.id !== id);
    _cache = next;
    setItems(next);
    return true;
  }, [items]);

  // Find best match for a product name (for receipt categorisation)
  const findByName = useCallback((name) => {
    if (!name) return null;
    const q = name.toLowerCase().trim();
    // Exact match first
    const exact = items.find(i => i.name.toLowerCase() === q);
    if (exact) return exact;
    // Substring match
    return items.find(i =>
      i.name.toLowerCase().includes(q) || q.includes(i.name.toLowerCase())
    ) ?? null;
  }, [items]);

  return { items, loading, imageUrls, addMasterItem, updateMasterItem, deleteMasterItem, findByName };
}

/**
 * Fetch an image from Unsplash for a master item and cache it in the DB.
 * Skips if the item already has an image_url.
 * @param {number} id   - master item id
 * @param {string} name - product name to search for
 * @param {string} currentUrl - existing image_url (skip if set)
 */
export async function fetchAndCacheImage(id, name, currentUrl) {
  if (currentUrl) return currentUrl; // already cached

  try {
    const res  = await fetch(`/api/fetch-image?q=${encodeURIComponent(name + ' food')}`);
    const data = await res.json();
    if (!data.url) return null;

    // Save to master_items
    await supabase
      .from('master_items')
      .update({ image_url: data.url })
      .eq('id', id);

    return data.url;
  } catch (e) {
    console.warn('[fetchAndCacheImage] failed:', e.message);
    return null;
  }
}
