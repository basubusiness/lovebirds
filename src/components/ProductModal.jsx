/**
 * ProductModal.jsx
 *
 * Unified add + edit modal.
 *
 * ADD path (product = null):
 *   Step 1 — Search / quick-select from master items list
 *   Step 2 — Form pre-filled from master item (or blank for custom)
 *
 * EDIT path (product = existing):
 *   Goes straight to form.
 *   Bottom section shows manual vs system-learned burn rate with Accept button.
 */

import { useState, useMemo } from 'react';
import Modal from './Modal';
import { VENDORS, UNITS } from '../constants';
import { useCategories } from '../hooks/useCategories';
import { uid } from '../utils';
import styles from './ProductModal.module.css';

// Convert qty+interval → units/day
function toRate(qty, days) {
  if (!qty || !days || days <= 0) return 0;
  return parseFloat((qty / days).toFixed(4));
}

// Convert units/day → human string e.g. "1 L every 3 days"
function rateToHuman(rate, unit) {
  if (!rate || rate <= 0) return '—';
  const days = Math.round(1 / rate);
  if (days <= 1) return `${rate.toFixed(2)} ${unit}/day`;
  return `1 ${unit} every ${days} day${days !== 1 ? 's' : ''}`;
}

const BLANK = {
  name: '', categoryId: null, unit: 'pc',
  minQty: 1, currentQty: 0,
  vendor: 'cactus', burnRate: 0,
  manualBurnQty: 1, manualBurnIntervalDays: 7,
  note: '',
};

// ── Step 1: Quick-select ──────────────────────────────────────

function QuickSelectStep({ masterItems, loadingMaster, onSelect, onCustom, onClose }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return masterItems.filter(i => i.name.toLowerCase().includes(q));
  }, [masterItems, search]);

  return (
    <Modal title="Add item" onClose={onClose} maxWidth={480}>
      <div className={styles.searchWrap}>
        <input
          className={styles.searchInput}
          placeholder="Search milk, rice, laundry…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />
      </div>

      {loadingMaster ? (
        <div className={styles.empty}>Loading…</div>
      ) : (
        <div className={styles.masterList}>
          {filtered.map(item => (
            <button
              key={item.id}
              className={styles.masterRow}
              onClick={() => onSelect(item)}
            >
              <span className={styles.masterName}>{item.name}</span>
              <span className={styles.masterMeta}>
                {item.default_burn_qty} {item.unit} / {item.default_burn_interval_days}d
              </span>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className={styles.empty}>No match found</div>
          )}
        </div>
      )}

      <div className={styles.customRow}>
        <span className={styles.customText}>Not in the list?</span>
        <button className={styles.customBtn} onClick={onCustom}>
          Add custom item →
        </button>
      </div>
    </Modal>
  );
}

// ── Step 2 / Edit: Form ───────────────────────────────────────

function ProductForm({ initial, isEdit, learnedRate, onSave, onDelete, onBack, onClose, onAcceptLearned }) {
  const [form, setForm] = useState({ ...BLANK, id: uid(), ...initial });
  const { flatList } = useCategories();

  const upd = (key, val) => setForm(f => ({ ...f, [key]: val }));

  // Keep burnRate in sync with manual pattern
  const updBurn = (key, val) => {
    setForm(f => {
      const next = { ...f, [key]: val };
      next.burnRate = toRate(
        key === 'manualBurnQty' ? val : next.manualBurnQty,
        key === 'manualBurnIntervalDays' ? val : next.manualBurnIntervalDays
      );
      return next;
    });
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    onSave({ ...form });
  };

  const divergence = learnedRate && form.burnRate
    ? Math.round(Math.abs(learnedRate - form.burnRate) / form.burnRate * 100)
    : null;

  // Category options — subcategories only (leaf nodes)
  const catOptions = flatList.filter(c => c.parent_id !== null);

  return (
    <Modal
      title={isEdit ? `Edit — ${form.name}` : 'Add item'}
      onClose={onClose}
      maxWidth={480}
    >
      {!isEdit && (
        <button className={styles.backBtn} onClick={onBack}>← Back to list</button>
      )}

      {/* Name */}
      <div className={styles.formRow}>
        <label>Product name</label>
        <input
          value={form.name}
          onChange={e => upd('name', e.target.value)}
          placeholder="e.g. Whole Milk"
          autoFocus={!isEdit}
        />
      </div>

      {/* Category + Unit */}
      <div className={styles.formGrid}>
        <div className={styles.formRow}>
          <label>Category</label>
          <select
            value={form.categoryId ?? ''}
            onChange={e => upd('categoryId', e.target.value ? parseInt(e.target.value) : null)}
          >
            <option value="">Uncategorized</option>
            {catOptions.map(c => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className={styles.formRow}>
          <label>Unit</label>
          <select value={form.unit} onChange={e => upd('unit', e.target.value)}>
            {UNITS.map(u => <option key={u}>{u}</option>)}
          </select>
        </div>
      </div>

      {/* Qty */}
      <div className={styles.formGrid}>
        <div className={styles.formRow}>
          <label>Current qty ({form.unit})</label>
          <input type="number" step="0.5" min="0" value={form.currentQty}
            onChange={e => upd('currentQty', parseFloat(e.target.value) || 0)} />
        </div>
        <div className={styles.formRow}>
          <label>Safety stock min ({form.unit})</label>
          <input type="number" step="0.5" min="0" value={form.minQty}
            onChange={e => upd('minQty', parseFloat(e.target.value) || 0)} />
        </div>
      </div>

      {/* Vendor */}
      <div className={styles.formRow}>
        <label>Preferred vendor</label>
        <select value={form.vendor} onChange={e => upd('vendor', e.target.value)}>
          {VENDORS.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </div>

      {/* Consumption pattern — qty + interval */}
      <div className={styles.formRow}>
        <label>My consumption pattern</label>
        <div className={styles.burnRow}>
          <span className={styles.burnLabel}>I use</span>
          <input
            type="number" step="0.5" min="0.1"
            className={styles.burnQtyInput}
            value={form.manualBurnQty}
            onChange={e => updBurn('manualBurnQty', parseFloat(e.target.value) || 1)}
          />
          <span className={styles.burnLabel}>{form.unit} every</span>
          <input
            type="number" step="1" min="1"
            className={styles.burnDaysInput}
            value={form.manualBurnIntervalDays}
            onChange={e => updBurn('manualBurnIntervalDays', parseInt(e.target.value) || 1)}
          />
          <span className={styles.burnLabel}>days</span>
        </div>
        <div className={styles.burnRate}>
          → {toRate(form.manualBurnQty, form.manualBurnIntervalDays).toFixed(3)} {form.unit}/day
        </div>
      </div>

      {/* Notes */}
      <div className={styles.formRow}>
        <label>Notes (optional)</label>
        <textarea
          rows={2}
          value={form.note}
          onChange={e => upd('note', e.target.value)}
          placeholder="e.g. Buy organic when possible"
          style={{ resize: 'vertical' }}
        />
      </div>

      {/* ── Manual vs Learned comparison (edit only) ── */}
      {isEdit && learnedRate != null && (
        <div className={styles.learnedBox}>
          <div className={styles.learnedTitle}>System learned rate</div>
          <div className={styles.learnedCompare}>
            <div className={styles.learnedCol}>
              <div className={styles.learnedColLabel}>Your definition</div>
              <div className={styles.learnedValue}>
                {rateToHuman(form.burnRate, form.unit)}
              </div>
            </div>
            <div className={styles.learnedDivider}>vs</div>
            <div className={styles.learnedCol}>
              <div className={styles.learnedColLabel}>System learned</div>
              <div className={`${styles.learnedValue} ${divergence > 20 ? styles.learnedDiverged : ''}`}>
                {rateToHuman(learnedRate, form.unit)}
              </div>
            </div>
          </div>
          {divergence > 10 && (
            <div className={styles.learnedDivergence}>
              {divergence}% difference from your definition
            </div>
          )}
          <button
            className={styles.acceptBtn}
            onClick={() => onAcceptLearned(learnedRate)}
          >
            Accept system rate
          </button>
        </div>
      )}

      <div className={styles.actions}>
        {isEdit && (
          <button className={styles.deleteBtn} onClick={() => onDelete(form.id)}>
            Delete
          </button>
        )}
        <div className={styles.rightActions}>
          <button onClick={onClose}>Cancel</button>
          <button className={styles.saveBtn} onClick={handleSave}>
            {isEdit ? 'Save changes' : 'Add to inventory'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Main export ───────────────────────────────────────────────

export default function ProductModal({
  product,          // null = add mode, object = edit mode
  masterItems,
  loadingMaster,
  learnedRate,      // EWMA burn rate from useConsumptionLog
  onSave,
  onDelete,
  onClose,
  onAcceptLearned,  // (rate) → writes learned rate back as manual baseline
}) {
  const isEdit = !!product?.id;
  // Add mode starts at step 1 (quick-select); edit goes straight to form
  const [step, setStep] = useState(isEdit ? 'form' : 'select');
  const [prefill, setPrefill] = useState(isEdit ? product : null);

  const handleSelect = (masterItem) => {
    setPrefill({
      name:                    masterItem.name,
      categoryId:              masterItem.category_id ?? null,
      unit:                    masterItem.unit,
      minQty:                  masterItem.default_min_qty,
      currentQty:              0,
      vendor:                  masterItem.default_vendor || 'cactus',
      burnRate:                toRate(masterItem.default_burn_qty, masterItem.default_burn_interval_days),
      manualBurnQty:           masterItem.default_burn_qty,
      manualBurnIntervalDays:  masterItem.default_burn_interval_days,
      note:                    masterItem.notes || '',
    });
    setStep('form');
  };

  const handleCustom = () => {
    setPrefill(null);
    setStep('form');
  };

  if (step === 'select') {
    return (
      <QuickSelectStep
        masterItems={masterItems}
        loadingMaster={loadingMaster}
        onSelect={handleSelect}
        onCustom={handleCustom}
        onClose={onClose}
      />
    );
  }

  return (
    <ProductForm
      initial={prefill ?? {}}
      isEdit={isEdit}
      learnedRate={learnedRate}
      onSave={onSave}
      onDelete={onDelete}
      onBack={() => setStep('select')}
      onClose={onClose}
      onAcceptLearned={onAcceptLearned}
    />
  );
}
