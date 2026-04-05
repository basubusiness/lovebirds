/**
 * useProducts.js
 *
 * Drop-in replacement for useLocalStorage('hirt_products', SEED_PRODUCTS).
 * Fetches from Supabase, mirrors the same [products, setProducts] API,
 * and keeps an optimistic local copy for instant UI feedback.
 *
 * Usage in App.jsx:
 *   - Remove:  const [products, setProducts] = useLocalStorage('hirt_products', SEED_PRODUCTS);
 *   - Add:     const [products, setProducts, loading] = useProducts();
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// Map DB snake_case columns → JS camelCase product shape
function fromDb(row) {
  return {
    id:         row.id,
    name:       row.name,
    cat:        row.cat,
    unit:       row.unit,
    minQty:     row.min_qty,
    currentQty: row.current_qty,
    vendor:     row.vendor,
    burnRate:   row.burn_rate,
    note:       row.note,
  };
}

// Map JS product shape → DB columns (omit id for inserts)
function toDb(p, userId) {
  return {
    id:          p.id,
    user_id:     userId,
    name:        p.name,
    cat:         p.cat,
    unit:        p.unit,
    min_qty:     p.minQty,
    current_qty: p.currentQty,
    vendor:      p.vendor,
    burn_rate:   p.burnRate,
    note:        p.note ?? '',
  };
}

export function useProducts() {
  const [products, setProductsLocal] = useState([]);
  const [loading,  setLoading]       = useState(true);
  const [userId,   setUserId]        = useState(null);

  // Get current user on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data?.user?.id ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch products whenever userId changes
  useEffect(() => {
    if (!userId) {
      setProductsLocal([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error('[useProducts] fetch error:', error);
        setProductsLocal((data ?? []).map(fromDb));
        setLoading(false);
      });
  }, [userId]);

  /**
   * setProducts — accepts either a new array or an updater function,
   * matching the useState / useLocalStorage API exactly.
   *
   * Computes the diff and upserts/deletes changed rows in Supabase.
   */
  const setProducts = useCallback(async (nextOrUpdater) => {
    setProductsLocal(prev => {
      const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(prev) : nextOrUpdater;

      // Async side-effect: persist to Supabase
      // We do this inside the setState callback so `prev` is the committed state
      if (userId) {
        persistDiff(prev, next, userId).catch(e =>
          console.error('[useProducts] persist error:', e)
        );
      }

      return next;
    });
  }, [userId]);

  return [products, setProducts, loading];
}

// ── Diff & persist ──────────────────────────────────────────────────────────

async function persistDiff(prev, next, userId) {
  const prevMap = Object.fromEntries(prev.map(p => [p.id, p]));
  const nextMap = Object.fromEntries(next.map(p => [p.id, p]));

  const toUpsert = next.filter(p => {
    const old = prevMap[p.id];
    return !old || JSON.stringify(old) !== JSON.stringify(p);
  });

  const toDelete = prev
    .filter(p => !nextMap[p.id])
    .map(p => p.id);

  const promises = [];

  if (toUpsert.length > 0) {
    promises.push(
      supabase
        .from('products')
        .upsert(toUpsert.map(p => toDb(p, userId)), { onConflict: 'id' })
        .then(({ error }) => {
          if (error) throw error;
        })
    );
  }

  if (toDelete.length > 0) {
    promises.push(
      supabase
        .from('products')
        .delete()
        .in('id', toDelete)
        .then(({ error }) => {
          if (error) throw error;
        })
    );
  }

  await Promise.all(promises);
}
