/**
 * useConsumptionLog.js
 *
 * Manages the consumption_log table and derives burn rates with recency bias.
 *
 * Burn rate calculation:
 *   Exponentially Weighted Moving Average (EWMA) over log entries.
 *   Each entry gets weight = e^(-λ · age_in_days), λ = 0.1
 *   So a 7-day-old entry weighs ~50% of today's entry.
 *   Only consume + finished entries count (not restocks).
 *   Returns units-per-day. Returns null if fewer than 2 data points.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const LAMBDA = 0.1; // recency decay — halves weight every ~7 days

// ── EWMA burn rate ────────────────────────────────────────────

function calcBurnRate(entries) {
  // Only consumption events (negative deltas)
  const consumptions = entries
    .filter(e => e.qty_delta < 0)
    .map(e => ({
      qty:  Math.abs(e.qty_delta),
      age:  (Date.now() - new Date(e.logged_at).getTime()) / 86400000, // days ago
    }))
    .sort((a, b) => a.age - b.age); // oldest last

  if (consumptions.length < 2) return null;

  // Span of data in days (needed to convert total weighted qty → per-day rate)
  const span = consumptions[consumptions.length - 1].age - consumptions[0].age;
  if (span < 0.5) return null; // all within 12h — not enough signal

  let weightedSum = 0;
  let totalWeight = 0;

  for (const { qty, age } of consumptions) {
    const w = Math.exp(-LAMBDA * age);
    weightedSum += qty * w;
    totalWeight += w;
  }

  // Average daily qty consumed (weighted)
  const avgQty = weightedSum / totalWeight;

  // Estimate interval between consumptions (weighted harmonic span / count)
  const avgIntervalDays = span / (consumptions.length - 1);

  const ratePerDay = avgQty / Math.max(avgIntervalDays, 0.1);
  return parseFloat(ratePerDay.toFixed(4));
}

// ── Hook ─────────────────────────────────────────────────────

export function useConsumptionLog() {
  const [userId,   setUserId]   = useState(null);
  // Map of productId → computed burn rate
  const [burnRates, setBurnRates] = useState({});

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data?.user?.id ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setUserId(s?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Fetch recent logs (last 90 days) and compute burn rates
  useEffect(() => {
    if (!userId) return;
    const since = new Date(Date.now() - 90 * 86400000).toISOString();
    supabase
      .from('consumption_log')
      .select('product_id, qty_delta, log_type, logged_at')
      .eq('user_id', userId)
      .gte('logged_at', since)
      .order('logged_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) { console.error('[useConsumptionLog] fetch:', error); return; }
        // Group by product
        const byProduct = {};
        for (const entry of (data ?? [])) {
          if (!byProduct[entry.product_id]) byProduct[entry.product_id] = [];
          byProduct[entry.product_id].push(entry);
        }
        const rates = {};
        for (const [pid, entries] of Object.entries(byProduct)) {
          const r = calcBurnRate(entries);
          if (r !== null) rates[pid] = r;
        }
        setBurnRates(rates);
      });
  }, [userId]);

  // Append a log entry and update burn rates for that product
  const appendLog = useCallback(async (productId, qtyDelta, logType = 'consume') => {
    if (!userId) return;
    const { error } = await supabase
      .from('consumption_log')
      .insert({
        user_id:    userId,
        product_id: productId,
        qty_delta:  qtyDelta,
        log_type:   logType,
        logged_at:  new Date().toISOString(),
      });
    if (error) { console.error('[useConsumptionLog] insert:', error); return; }

    // Re-fetch this product's logs to recalculate its burn rate
    const since = new Date(Date.now() - 90 * 86400000).toISOString();
    const { data } = await supabase
      .from('consumption_log')
      .select('product_id, qty_delta, log_type, logged_at')
      .eq('user_id', userId)
      .eq('product_id', productId)
      .gte('logged_at', since)
      .order('logged_at', { ascending: true });

    if (data) {
      const r = calcBurnRate(data);
      setBurnRates(prev => ({
        ...prev,
        [productId]: r ?? prev[productId] ?? 0,
      }));
    }
  }, [userId]);

  return { burnRates, appendLog };
}
