/**
 * useProducts.js
 * Supabase-backed product store. Drop-in for useLocalStorage.
 * Now includes category_id field.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

function fromDb(row) {
  return {
    id:                      row.id,
    name:                    row.name,
    cat:                     row.cat,
    categoryId:              row.category_id,
    unit:                    row.unit,
    minQty:                  row.min_qty,
    currentQty:              row.current_qty,
    vendor:                  row.vendor,
    burnRate:                row.burn_rate,
    manualBurnQty:           row.manual_burn_qty ?? null,
    manualBurnIntervalDays:  row.manual_burn_interval_days ?? null,
    masterItemId:            row.master_item_id ?? null,
    image_url:               row.image_url ?? null,
    note:                    row.note,
  };
}

function toDb(p, userId) {
  return {
    id:                         p.id,
    user_id:                    userId,
    name:                       p.name,
    cat:                        p.cat ?? 'Other',
    category_id:                p.categoryId ?? null,
    unit:                       p.unit,
    min_qty:                    p.minQty,
    current_qty:                p.currentQty,
    vendor:                     p.vendor,
    burn_rate:                  p.burnRate,
    manual_burn_qty:            p.manualBurnQty ?? null,
    manual_burn_interval_days:  p.manualBurnIntervalDays ?? null,
    master_item_id:             p.masterItemId ?? null,
    image_url:                  p.image_url ?? null,
    note:                       p.note ?? '',
  };
}

export function useProducts() {
  const [products, setProductsLocal] = useState([]);
  const [loading,  setLoading]       = useState(true);
  const [userId,   setUserId]        = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data?.user?.id ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) { setProductsLocal([]); setLoading(false); return; }
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

  const setProducts = useCallback(async (nextOrUpdater) => {
    setProductsLocal(prev => {
      const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(prev) : nextOrUpdater;
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

async function persistDiff(prev, next, userId) {
  const prevMap = Object.fromEntries(prev.map(p => [p.id, p]));
  const nextMap = Object.fromEntries(next.map(p => [p.id, p]));

  const toUpsert = next.filter(p => {
    const old = prevMap[p.id];
    return !old || JSON.stringify(old) !== JSON.stringify(p);
  });
  const toDelete = prev.filter(p => !nextMap[p.id]).map(p => p.id);

  const promises = [];
  if (toUpsert.length > 0) {
    promises.push(
      supabase.from('products')
        .upsert(toUpsert.map(p => toDb(p, userId)), { onConflict: 'id' })
        .then(({ error }) => { if (error) throw error; })
    );
  }
  if (toDelete.length > 0) {
    promises.push(
      supabase.from('products')
        .delete().in('id', toDelete)
        .then(({ error }) => { if (error) throw error; })
    );
  }
  await Promise.all(promises);
}
