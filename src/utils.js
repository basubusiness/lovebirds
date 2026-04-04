import { VENDORS } from './constants';

export function uid() {
  return 'p' + Date.now() + Math.random().toString(36).slice(2, 6);
}

export function vendorOf(id) {
  return VENDORS.find(v => v.id === id) || { name: id, color: '#888', leadDays: 3, minOrder: 0 };
}

/** 'ok' | 'low' | 'critical' */
export function getStatus(p) {
  if (p.currentQty <= 0) return 'critical';
  if (p.currentQty <= p.minQty) return 'critical';
  if (p.currentQty <= p.minQty * 1.5) return 'low';
  return 'ok';
}

/** Days until exhaustion using t = I / R */
export function daysLeft(p) {
  if (!p.burnRate || p.burnRate === 0) return null;
  return Math.max(0, Math.round(p.currentQty / p.burnRate));
}

/** Stock bar fill percentage (0–100) */
export function stockPct(p) {
  const full = Math.max(p.minQty * 3, p.currentQty);
  return Math.min(100, Math.max(0, Math.round((p.currentQty / full) * 100)));
}

export function barColor(status) {
  if (status === 'critical') return '#E24B4A';
  if (status === 'low') return '#EF9F27';
  return '#1D9E75';
}

/** True if item needs ordering (days left ≤ lead time + 2-day buffer) */
export function needsOrder(p) {
  const dl = daysLeft(p);
  const lead = vendorOf(p.vendor).leadDays;
  return dl !== null && dl <= lead + 2;
}
