/**
 * PatternsTab.jsx
 *
 * Shows all products with their consumption patterns.
 * Two views via toggle:
 *   "My definitions"  — manual qty + interval set by the user
 *   "System learned"  — EWMA rate derived from consumption logs
 *
 * Items where system rate diverges >20% from manual are flagged.
 * "Accept system" button writes learned rate back as manual baseline.
 */

import { useState } from 'react';
import styles from './PatternsTab.module.css';

function rateToHuman(rate, unit) {
  if (!rate || rate <= 0) return '—';
  const days = Math.round(1 / rate);
  if (days <= 1) return `${rate.toFixed(2)} ${unit}/day`;
  return `1 ${unit} every ${days}d`;
}

function manualToHuman(qty, interval, unit) {
  if (!qty || !interval) return '—';
  return `${qty} ${unit} every ${interval}d`;
}

function divergencePct(manual, learned) {
  if (!manual || !learned || manual === 0) return null;
  return Math.round(Math.abs(learned - manual) / manual * 100);
}

export default function PatternsTab({ products, burnRates, onAcceptLearned, onEdit }) {
  const [view, setView] = useState('manual'); // 'manual' | 'learned'

  // Show ALL products — Patterns tab is where you define patterns,
  // not just where you view existing ones
  const tracked = [...products].sort((a, b) => a.name.localeCompare(b.name));

  // Products where divergence is notable (>20%)
  const diverged = tracked.filter(p => {
    const manualRate = p.burnRate;
    const learned = burnRates[p.id];
    const d = divergencePct(manualRate, learned);
    return d !== null && d > 20;
  });

  return (
    <div>
      {/* ── View toggle ── */}
      <div className={styles.toolbar}>
        <div className={styles.toggle}>
          <button
            className={`${styles.toggleBtn} ${view === 'manual' ? styles.toggleActive : ''}`}
            onClick={() => setView('manual')}
          >
            My definitions
          </button>
          <button
            className={`${styles.toggleBtn} ${view === 'learned' ? styles.toggleActive : ''}`}
            onClick={() => setView('learned')}
          >
            System learned
          </button>
        </div>
        {diverged.length > 0 && (
          <span className={styles.divergeBadge}>
            {diverged.length} item{diverged.length !== 1 ? 's' : ''} diverged
          </span>
        )}
      </div>

      {tracked.length === 0 ? (
        <div className={styles.empty}>
          No items in inventory yet. Add items first, then set consumption patterns here.
        </div>
      ) : (
        <div className={styles.table}>
          {/* Header */}
          <div className={styles.headerRow}>
            <span className={styles.colName}>Product</span>
            <span className={styles.colRate}>
              {view === 'manual' ? 'Your pattern' : 'System learned'}
            </span>
            <span className={styles.colDiff}>vs other</span>
            <span className={styles.colAction}>Action</span>
          </div>

          {tracked.map(p => {
            const manualRate  = p.burnRate ?? 0;
            const learnedRate = burnRates[p.id] ?? null;
            const diff        = divergencePct(manualRate, learnedRate);
            const isDiverged  = diff !== null && diff > 20;

            // For pre-patch4 products, fall back to raw burnRate for manual display
            const manualDisplay = p.manualBurnQty && p.manualBurnIntervalDays
              ? manualToHuman(p.manualBurnQty, p.manualBurnIntervalDays, p.unit)
              : rateToHuman(manualRate, p.unit);

            const displayRate = view === 'manual'
              ? manualDisplay
              : rateToHuman(learnedRate, p.unit);

            const otherRate = view === 'manual'
              ? rateToHuman(learnedRate, p.unit)
              : manualDisplay;

            return (
              <div
                key={p.id}
                className={`${styles.row} ${isDiverged ? styles.rowDiverged : ''}`}
              >
                <div className={styles.colName}>
                  <div className={styles.productName}>{p.name}</div>
                  <div className={styles.productUnit}>{p.unit}</div>
                </div>

                <div className={styles.colRate}>
                  <span className={`${styles.rateValue} ${displayRate === '—' ? styles.rateMissing : ''}`}>
                    {displayRate}
                  </span>
                </div>

                <div className={styles.colDiff}>
                  {otherRate !== '—' && (
                    <span className={styles.otherRate}>{otherRate}</span>
                  )}
                  {isDiverged && (
                    <span className={styles.diffBadge}>{diff}% diff</span>
                  )}
                </div>

                <div className={styles.colAction}>
                  {learnedRate && isDiverged && view === 'manual' && (
                    <button
                      className={styles.acceptBtn}
                      onClick={() => onAcceptLearned(p.id, learnedRate)}
                      title="Replace your manual rate with the system's learned rate"
                    >
                      Accept system
                    </button>
                  )}
                  <button
                    className={styles.editBtn}
                    onClick={() => onEdit(p)}
                    title={manualRate ? 'Edit pattern' : 'Set pattern'}
                  >
                    {manualRate ? '✎' : '+ set'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
