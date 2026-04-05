/**
 * useVendorSchedules.js
 *
 * CRUD for vendor_schedules table.
 * Also exposes nextShopDate(vendorId) — computed from schedule + today.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const DAY_MS = 86400000;

// Given a schedule row, compute the next shop date from today
export function computeNextDate(schedule) {
  if (!schedule) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (schedule.next_order_date) {
    const override = new Date(schedule.next_order_date);
    override.setHours(0, 0, 0, 0);
    if (override >= today) return override;
  }

  if (schedule.schedule_type === 'fixed' && schedule.day_of_week != null) {
    const target = schedule.day_of_week; // 0=Sun
    const current = today.getDay();
    let daysUntil = (target - current + 7) % 7;
    if (daysUntil === 0) daysUntil = 7; // next week if today is the day
    return new Date(today.getTime() + daysUntil * DAY_MS);
  }

  if (schedule.schedule_type === 'flexible' && schedule.interval_days) {
    return new Date(today.getTime() + schedule.interval_days * DAY_MS);
  }

  return null;
}

export function useVendorSchedules() {
  const [schedules, setSchedules] = useState([]);
  const [userId,    setUserId]    = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data?.user?.id ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setUserId(s?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) { setSchedules([]); return; }
    supabase
      .from('vendor_schedules')
      .select('*')
      .eq('user_id', userId)
      .then(({ data, error }) => {
        if (error) console.error('[useVendorSchedules] fetch:', error);
        setSchedules(data ?? []);
      });
  }, [userId]);

  const upsertSchedule = useCallback(async (vendorId, patch) => {
    if (!userId) return;
    const row = {
      user_id:        userId,
      vendor_id:      vendorId,
      schedule_type:  patch.scheduleType ?? 'flexible',
      day_of_week:    patch.dayOfWeek ?? null,
      interval_days:  patch.intervalDays ?? null,
      next_order_date: patch.nextOrderDate ?? null,
      updated_at:     new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('vendor_schedules')
      .upsert(row, { onConflict: 'user_id,vendor_id' })
      .select()
      .single();
    if (error) { console.error('[useVendorSchedules] upsert:', error); return; }
    setSchedules(prev => {
      const idx = prev.findIndex(s => s.vendor_id === vendorId);
      if (idx >= 0) { const n = [...prev]; n[idx] = data; return n; }
      return [...prev, data];
    });
  }, [userId]);

  const getSchedule = useCallback((vendorId) =>
    schedules.find(s => s.vendor_id === vendorId) ?? null,
  [schedules]);

  const nextShopDate = useCallback((vendorId) =>
    computeNextDate(getSchedule(vendorId)),
  [getSchedule]);

  return { schedules, upsertSchedule, getSchedule, nextShopDate };
}
