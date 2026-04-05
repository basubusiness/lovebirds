/**
 * useCategories.js
 * Fetches the category tree from Supabase and exposes helpers.
 * Categories are global (not per-user) so we cache them in module scope.
 */

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

let _cache = null; // module-level cache so we only fetch once per session

export function useCategories() {
  const [categories, setCategories] = useState(_cache || []);
  const [loading, setLoading] = useState(!_cache);

  useEffect(() => {
    if (_cache) return;
    supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error('[useCategories]', error);
        const cats = data || [];
        _cache = cats;
        setCategories(cats);
        setLoading(false);
      });
  }, []);

  /** All top-level categories (parent_id is null) */
  const topLevel = categories.filter(c => c.parent_id === null);

  /** Children of a given parent id */
  const childrenOf = (parentId) =>
    categories.filter(c => c.parent_id === parentId);

  /** Find a category by id */
  const byId = (id) => categories.find(c => c.id === id) || null;

  /** Flat list of all categories for dropdowns: "Grocery › Fresh Produce" */
  const flatList = categories.map(c => {
    const parent = c.parent_id ? categories.find(p => p.id === c.parent_id) : null;
    return {
      ...c,
      label: parent ? `${parent.name} › ${c.name}` : c.name,
    };
  }).sort((a, b) => {
    // Sort: top-level first by sort_order, then children grouped under parent
    const aParent = a.parent_id ?? a.id;
    const bParent = b.parent_id ?? b.id;
    if (aParent !== bParent) return aParent - bParent;
    return (a.parent_id ? 1 : 0) - (b.parent_id ? 1 : 0) || a.sort_order - b.sort_order;
  });

  return { categories, topLevel, childrenOf, byId, flatList, loading };
}
