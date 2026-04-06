/**
 * QuickEditModal.jsx
 *
 * Lightweight edit modal for the most-changed fields:
 *   - Unit
 *   - Consumption pattern (qty + interval → plain language)
 *   - Safety stock (min qty)
 *
 * "More settings →" opens the full ProductModal.
 * Designed to feel like a quick tweak, not a form.
 */

import { useState } from 'react';
import Modal from './Modal';
import { UNITS } from '../constants';
import styles from './QuickEditModal.module.css';

function toRate(qty, days) {
  if (!qty || !days || days <= 0) return 0;
  return parseFloat((qty / days).toFixed(4));
}

// Decompose a raw burnRate → qty + interval (best round numbers)
function rateToComponents(rate, currentQty, currentInterval) {
  if (currentQty && currentInterval) return { qty: currentQty, interval: currentInterval };
  if (!rate || rate <= 0) return { qty: 1, interval: 7 };
  const interval = Math.max(1, Math.round(1 / rate));
  return { qty: 1, interval };
}

export default function QuickEditModal({ product, learnedRate, onSave, onFullEdit, onClose }) {
  const init = rateToComponents(
    product.burnRate,
    product.manualBurnQty,
    product.manualBurnIntervalDays
  );

  const [unit,     setUnit]     = useState(product.unit || 'pc');
  const [burnQty,  setBurnQty]  = useState(init.qty);
  const [burnDays, setBurnDays] = useState(init.interval);
  const [minQty,   setMinQty]   = useState(product.minQty || 1);

  const computedRate = toRate(burnQty, burnDays);

  const handleSave = () => {
    onSave({
      ...product,
      unit,
      minQty:                 parseFloat(minQty) || 1,
      burnRate:               computedRate,
      manualBurnQty:          parseFloat(burnQty) || 1,
      manualBurnIntervalDays: parseInt(burnDays) || 7,
    });
  };

  return (
    <Modal title={product.name} onClose={onClose} maxWidth={340}>

      {/* Unit */}
      <div className={styles.field}>
        <label className={styles.label}>Unit</label>
        <div className={styles.unitPills}>
          {UNITS.map(u => (
            <button
              key={u}
              className={`${styles.unitPill} ${unit === u ? styles.unitPillActive : ''}`}
              onClick={() => setUnit(u)}
            >{u}</button>
          ))}
        </div>
      </div>

      {/* Consumption frequency */}
      <div className={styles.field}>
        <label className={styles.label}>I use this</label>
        <div className={styles.freqRow}>
          <input
            type="number"
            className={styles.numInput}
            min="0.1"
            step="0.5"
            value={burnQty}
            onChange={e => setBurnQty(parseFloat(e.target.value) || 1)}
          />
          <span className={styles.freqUnit}>{unit}</span>
          <span className={styles.freqEvery}>every</span>
          <input
            type="number"
            className={styles.numInput}
            min="1"
            step="1"
            value={burnDays}
            onChange={e => setBurnDays(parseInt(e.target.value) || 1)}
          />
          <span className={styles.freqUnit}>days</span>
        </div>
        <div className={styles.ratePreview}>
          = {computedRate.toFixed(3)} {unit}/day
          {learnedRate && learnedRate > 0 && (
            <button
              className={styles.useLearnedBtn}
              onClick={() => {
                const days = Math.max(1, Math.round(1 / learnedRate));
                setBurnQty(1);
                setBurnDays(days);
              }}
            >
              Use system rate (1 {unit} / {Math.max(1, Math.round(1 / learnedRate))}d)
            </button>
          )}
        </div>
      </div>

      {/* Safety stock */}
      <div className={styles.field}>
        <label className={styles.label}>Order when below</label>
        <div className={styles.freqRow}>
          <input
            type="number"
            className={styles.numInput}
            min="0"
            step="0.5"
            value={minQty}
            onChange={e => setMinQty(parseFloat(e.target.value) || 0)}
          />
          <span className={styles.freqUnit}>{unit}</span>
        </div>
      </div>

      <div className={styles.actions}>
        <button className={styles.fullEditBtn} onClick={onFullEdit}>
          More settings →
        </button>
        <div className={styles.rightActions}>
          <button onClick={onClose}>Cancel</button>
          <button className={styles.saveBtn} onClick={handleSave}>Save</button>
        </div>
      </div>
    </Modal>
  );
}
