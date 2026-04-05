/**
 * Dashboard.jsx
 *
 * Sections:
 *   1. Metric cards (total / critical / low / ok)
 *   2. 30-day consumption forecast — SVG timeline, one line per item with burn rate
 *   3. Vendor schedule cards — next shop date, item count, open shopping list
 *   4. Action needed list
 */

import { useState, useMemo } from 'react';
import { getStatus, daysLeft, vendorOf } from '../utils';
import { VENDORS } from '../constants';
import { computeNextDate } from '../hooks/useVendorSchedules';
import ShoppingListModal from './ShoppingListModal';
import styles from './Dashboard.module.css';

// ── Helpers ───────────────────────────────────────────────────

function fmt(date) {
  if (!date) return null;
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function daysFromNow(date) {
  return Math.round((date.getTime() - Date.now()) / 86400000);
}

// ── Forecast chart ────────────────────────────────────────────

const CHART_DAYS  = 30;
const CHART_W     = 600;
const CHART_H     = 160;
const PAD_L       = 8;
const PAD_R       = 8;
const PAD_T       = 12;
const PAD_B       = 24;
const PLOT_W      = CHART_W - PAD_L - PAD_R;
const PLOT_H      = CHART_H - PAD_T - PAD_B;

// Assign a stable colour per vendor
const VENDOR_COLORS = Object.fromEntries(VENDORS.map(v => [v.id, v.color]));

function ForecastChart({ products, schedules }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Only items with a burn rate set
  const tracked = products.filter(p => p.burnRate && p.burnRate > 0 && p.currentQty > 0);

  if (tracked.length === 0) return (
    <div className={styles.chartEmpty}>
      Set burn rates on products to see consumption forecast
    </div>
  );

  // X: day index 0–30 → pixel
  const xOf = (day) => PAD_L + (day / CHART_DAYS) * PLOT_W;
  // Y: 0% stock = bottom, 100% = top
  const yOf = (pct) => PAD_T + PLOT_H - (Math.min(pct, 1) * PLOT_H);

  // Day labels every 5 days
  const dayLabels = [0, 5, 10, 15, 20, 25, 30];

  return (
    <svg
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      className={styles.chart}
      aria-label="30-day stock forecast"
    >
      {/* Grid lines */}
      {dayLabels.map(d => (
        <g key={d}>
          <line
            x1={xOf(d)} y1={PAD_T}
            x2={xOf(d)} y2={PAD_T + PLOT_H}
            stroke="rgba(0,0,0,0.06)" strokeWidth="0.5"
          />
          <text
            x={xOf(d)} y={CHART_H - 6}
            textAnchor="middle" fontSize="9"
            fill="rgba(0,0,0,0.35)"
          >
            {d === 0 ? 'Today' : `+${d}d`}
          </text>
        </g>
      ))}

      {/* 0% line (runout) */}
      <line
        x1={PAD_L} y1={PAD_T + PLOT_H}
        x2={PAD_L + PLOT_W} y2={PAD_T + PLOT_H}
        stroke="rgba(0,0,0,0.12)" strokeWidth="0.5"
      />

      {/* Schedule vertical lines */}
      {schedules.map(sched => {
        const date = computeNextDate(sched);
        if (!date) return null;
        const days = daysFromNow(date);
        if (days < 0 || days > CHART_DAYS) return null;
        const color = VENDOR_COLORS[sched.vendor_id] || '#888';
        return (
          <g key={sched.vendor_id}>
            <line
              x1={xOf(days)} y1={PAD_T}
              x2={xOf(days)} y2={PAD_T + PLOT_H}
              stroke={color} strokeWidth="1"
              strokeDasharray="3 2" opacity="0.6"
            />
            <text
              x={xOf(days) + 3} y={PAD_T + 9}
              fontSize="8" fill={color} opacity="0.9"
            >
              {VENDORS.find(v => v.id === sched.vendor_id)?.name ?? sched.vendor_id}
            </text>
          </g>
        );
      })}

      {/* Forecast lines per product */}
      {tracked.map(p => {
        const color = VENDOR_COLORS[p.vendor] || '#888';
        const startPct = p.minQty > 0 ? p.currentQty / p.minQty : 0;

        // Days until empty
        const daysToEmpty = p.currentQty / p.burnRate;

        // Build path: from today to min(daysToEmpty, 30)
        const endDay  = Math.min(daysToEmpty, CHART_DAYS);
        const endPct  = Math.max(0, startPct - (endDay / daysToEmpty) * startPct);

        const x1 = xOf(0);
        const y1 = yOf(startPct);
        const x2 = xOf(endDay);
        const y2 = yOf(endPct);

        return (
          <g key={p.id}>
            <line
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={color} strokeWidth="1.5" opacity="0.75"
            />
            {/* Runout dot if within 30 days */}
            {daysToEmpty <= CHART_DAYS && (
              <circle
                cx={x2} cy={PAD_T + PLOT_H}
                r="3" fill={color}
                opacity="0.9"
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Metric card ───────────────────────────────────────────────

function MetricCard({ label, value, colorClass }) {
  return (
    <div className={`${styles.metric} ${colorClass || ''}`}>
      <div className={styles.metricLabel}>{label}</div>
      <div className={styles.metricValue}>{value}</div>
    </div>
  );
}

// ── Vendor schedule card ──────────────────────────────────────

function VendorScheduleCard({ vendor, products, schedule, onOpenList, onAdHoc, onSettings }) {
  const nextDate  = computeNextDate(schedule);
  const dayCount  = nextDate ? daysFromNow(nextDate) : null;
  const items     = products.filter(p => p.vendor === vendor.id);
  const needCount = items.filter(p => getStatus(p) !== 'ok').length;

  // Forecast items running out before next shop
  const forecastCount = items.filter(p =>
    getStatus(p) === 'ok' &&
    p.burnRate > 0 &&
    nextDate &&
    (p.currentQty / p.burnRate) < daysFromNow(nextDate)
  ).length;

  const totalActionable = needCount + forecastCount;
  if (items.length === 0) return null;

  return (
    <div className={`${styles.schedCard} ${totalActionable > 0 ? styles.schedCardAlert : ''}`}>
      <div className={styles.schedTop}>
        <span className={styles.schedDot} style={{ background: vendor.color }} />
        <span className={styles.schedName}>{vendor.name}</span>
        {totalActionable > 0 && (
          <span className={styles.schedBadge}>{totalActionable} to order</span>
        )}
      </div>

      <div className={styles.schedMeta}>
        {nextDate ? (
          <span className={styles.schedDate}>
            Next: <strong>{fmt(nextDate)}</strong>
            {dayCount === 0 ? ' — today!' : dayCount === 1 ? ' — tomorrow' : ` — in ${dayCount}d`}
          </span>
        ) : (
          <span className={styles.schedDateMissing}>No schedule set</span>
        )}
      </div>

      <div className={styles.schedActions}>
        <button className={styles.schedBtn} onClick={() => onOpenList(vendor, nextDate, false)}>
          Shopping list
        </button>
        <button className={styles.schedBtnSecondary} onClick={() => onAdHoc(vendor)}>
          Ad hoc order
        </button>
        <button className={styles.schedBtnGhost} onClick={() => onSettings(vendor)}>
          ⚙
        </button>
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────

export default function Dashboard({ products, schedules, onOpenSettings }) {
  const [shoppingList, setShoppingList] = useState(null);

  const total    = products.length;
  const critical = products.filter(p => getStatus(p) === 'critical').length;
  const low      = products.filter(p => getStatus(p) === 'low').length;
  const ok       = total - critical - low;

  const alerts = products
    .filter(p => getStatus(p) !== 'ok')
    .sort((a, b) => (getStatus(a) === 'critical' ? -1 : 1));

  const activeVendors = useMemo(() =>
    VENDORS.filter(v => products.some(p => p.vendor === v.id)),
  [products]);

  const getSchedule = (vendorId) =>
    schedules.find(s => s.vendor_id === vendorId) ?? null;

  const openList = (vendor, nextDate, isAdHoc) => {
    setShoppingList({ vendor, nextDate: isAdHoc ? null : nextDate, isAdHoc });
  };

  return (
    <div>
      {/* ── Metrics ── */}
      <div className={styles.metricsGrid}>
        <MetricCard label="Total items"  value={total}    />
        <MetricCard label="Critical"     value={critical} colorClass={styles.metricCritical} />
        <MetricCard label="Low stock"    value={low}      colorClass={styles.metricLow} />
        <MetricCard label="Well stocked" value={ok}       colorClass={styles.metricOk} />
      </div>

      {/* ── 30-day forecast ── */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>30-day stock forecast</div>
        <div className={styles.chartLegend}>
          {activeVendors.map(v => (
            <span key={v.id} className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: v.color }} />
              {v.name}
            </span>
          ))}
        </div>
        <ForecastChart products={products} schedules={schedules} />
        <div className={styles.chartNote}>
          Dashed vertical lines = next scheduled shop. Dots = projected runout.
        </div>
      </div>

      {/* ── Vendor schedule cards ── */}
      {activeVendors.length > 0 && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>Store schedule</div>
          <div className={styles.schedGrid}>
            {activeVendors.map(v => (
              <VendorScheduleCard
                key={v.id}
                vendor={v}
                products={products}
                schedule={getSchedule(v.id)}
                onOpenList={openList}
                onAdHoc={(vendor) => openList(vendor, null, true)}
                onSettings={() => onOpenSettings(v)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Action needed ── */}
      {alerts.length > 0 && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>Action needed</div>
          {alerts.map(p => {
            const st = getStatus(p);
            const dl = daysLeft(p);
            const v  = vendorOf(p.vendor);
            return (
              <div key={p.id} className={`${styles.alertRow} ${styles[st]}`}>
                <div className={styles.alertInfo}>
                  <div className={styles.alertName}>{p.name}</div>
                  <div className={styles.alertSub}>
                    {p.currentQty} {p.unit} remaining · via {v.name}
                    {dl !== null && ` · ~${dl}d left`}
                  </div>
                </div>
                <span className={`${styles.badge} ${styles['badge_' + st]}`}>{st}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Shopping list modal */}
      {shoppingList && (
        <ShoppingListModal
          vendor={shoppingList.vendor}
          products={products}
          nextDate={shoppingList.nextDate}
          isAdHoc={shoppingList.isAdHoc}
          onClose={() => setShoppingList(null)}
        />
      )}
    </div>
  );
}
