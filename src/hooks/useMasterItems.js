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
  const [items,   setItems]   = useState(_cache || []);
  const [loading, setLoading] = useState(!_cache);
  const [userId,  setUserId]  = useState(null);

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
        _cache = data ?? [];
        setItems(_cache);
        setLoading(false);
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

  return { items, loading, addMasterItem, updateMasterItem, deleteMasterItem, findByName };
}
