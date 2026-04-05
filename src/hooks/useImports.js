/**
 * useImports.js
 *
 * Supabase-backed hook for receipt_imports table.
 * Provides: imports, loading, saveImport, deleteImport, updateImport
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

function fromDb(row) {
  return {
    id:           row.id,
    vendor:       row.vendor,
    purchaseDate: row.purchase_date,
    uploadedAt:   row.uploaded_at,
    items:        row.items ?? [],
  };
}

export function useImports() {
  const [imports, setImports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId,  setUserId]  = useState(null);

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
    if (!userId) { setImports([]); setLoading(false); return; }
    setLoading(true);
    supabase
      .from('receipt_imports')
      .select('*')
      .order('uploaded_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error('[useImports] fetch error:', error);
        setImports((data ?? []).map(fromDb));
        setLoading(false);
      });
  }, [userId]);

  const saveImport = useCallback(async (entry) => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('receipt_imports')
      .insert({
        user_id:       userId,
        vendor:        entry.vendor ?? '',
        purchase_date: entry.purchaseDate,
        uploaded_at:   new Date().toISOString(),
        items:         entry.items ?? [],
      })
      .select()
      .single();
    if (error) { console.error('[useImports] insert error:', error); return null; }
    const record = fromDb(data);
    setImports(prev => [record, ...prev]);
    return record;
  }, [userId]);

  const deleteImport = useCallback(async (id) => {
    const { error } = await supabase
      .from('receipt_imports')
      .delete()
      .eq('id', id);
    if (error) { console.error('[useImports] delete error:', error); return false; }
    setImports(prev => prev.filter(r => r.id !== id));
    return true;
  }, []);

  const updateImport = useCallback(async (id, patch) => {
    const { data, error } = await supabase
      .from('receipt_imports')
      .update({
        vendor:        patch.vendor,
        purchase_date: patch.purchaseDate,
        items:         patch.items,
      })
      .eq('id', id)
      .select()
      .single();
    if (error) { console.error('[useImports] update error:', error); return false; }
    const record = fromDb(data);
    setImports(prev => prev.map(r => r.id === id ? record : r));
    return record;
  }, []);

  return { imports, loading, saveImport, deleteImport, updateImport };
}
