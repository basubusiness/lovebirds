/**
 * PatternsTab.jsx
 *
 * Manages master_items — the stable consumption pattern library.
 * Completely independent of inventory stock levels.
 *
 * - Lists all master items (seed + user's own), alphabetically
 * - Shows consumption pattern (qty / interval) and system-learned rate where available
 * - "In inventory" chip shows how many inventory products are linked
 * - Add → creates new master item (no inventory entry)
 * - Edit → inline form to update pattern
 * - Delete → removes master item only (inventory products keep their stock, lose the link)
 * - Two views: My definitions | System learned
 */

import { useState } from 'react';
import { useCategories } from '../hooks/useCategories';
import { UNITS } from '../constants';
import styles from './PatternsTab.module.css';

function rateToHuman(rate, unit) {
  if (!rate || rate <= 0) return '—';
  const days = Math.round(1 / rate);
  if (days <= 1) return `${parseFloat(rate.toFixed(2))} ${unit}/day`;
  return `1 ${unit} every ${days}d`;
}

function manualToHuman(qty, interval, unit) {
  if (!qty || !interval) return '—';
  return `${qty} ${unit} every ${interval}d`;
}

function toRate(qty, days) {
  if (!qty || !days || days <= 0) return 0;
  return parseFloat((qty / days).toFixed(4));
}

function divergencePct(manual, learned) {
  if (!manual || !learned || manual === 0) return null;
  return Math.round(Math.abs(learned - manual) / manual * 100);
}

// ── Inline edit form ──────────────────────────────────────────

function EditForm({ item, categories, onSave, onCancel }) {
  const [name,     setName]     = useState(item?.name || '');
  const [catId,    setCatId]    = useState(item?.category_id ?? '');
  const [unit,     setUnit]     = useState(item?.unit || 'pc');
  const [burnQty,  setBurnQty]  = useState(item?.default_burn_qty || 1);
  const [burnDays, setBurnDays] = useState(item?.default_burn_interval_days || 7);
  const [minQty,   setMinQty]   = useState(item?.default_min_qty || 1);

  const subcats = categories.filter(c => c.parent_id !== null);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name:                          name.trim(),
      category_id:                   catId ? parseInt(catId) : null,
      unit,
      default_min_qty:               parseFloat(minQty) || 1,
      default_burn_qty:              parseFloat(burnQty) || 1,
      default_burn_interval_days:    parseInt(burnDays) || 7,
    });
  };

  return (
    <div className={styles.editForm}>
      <div className={styles.editGrid}>
        <div className={styles.editField}>
          <label>Name</label>
          <input value={name} onChange={e => setName(e.target.value)} autoFocus />
        </div>
        <div className={styles.editField}>
          <label>Category</label>
          <select value={catId} onChange={e => setCatId(e.target.value)}>
            <option value="">Uncategorized</option>
            {subcats.map(c => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className={styles.editField}>
          <label>Unit</label>
          <select value={unit} onChange={e => setUnit(e.target.value)}>
            {UNITS.map(u => <option key={u}>{u}</option>)}
          </select>
        </div>
        <div className={styles.editField}>
          <label>Safety stock (min)</label>
          <input type="number" min="0" step="0.5" value={minQty}
            onChange={e => setMinQty(e.target.value)} />
        </div>
      </div>
      <div className={styles.burnEditRow}>
        <span className={styles.burnLbl}>I use</span>
        <input type="number" min="0.1" step="0.5" className={styles.burnNum}
          value={burnQty} onChange={e => setBurnQty(e.target.value)} />
        <span className={styles.burnLbl}>{unit} every</span>
        <input type="number" min="1" step="1" className={styles.burnNum}
          value={burnDays} onChange={e => setBurnDays(e.target.value)} />
        <span className={styles.burnLbl}>days</span>
        <span className={styles.burnCalc}>
          → {toRate(burnQty, burnDays).toFixed(3)} {unit}/day
        </span>
      </div>
      <div className={styles.editActions}>
        <button onClick={onCancel}>Cancel</button>
        <button className={styles.saveBtn} onClick={handleSave}>Save pattern</button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

export default function PatternsTab({
  masterItems, loadingMaster,
  products,       // for "in inventory" count only
  burnRates,      // keyed by product_id — we aggregate per master item
  onAddMaster, onUpdateMaster, onDeleteMaster,
  onAcceptLearned,
}) {
  const [view,       setView]       = useState('manual');
  const [editingId,  setEditingId]  = useState(null);  // master item id being edited
  const [addingNew,  setAddingNew]  = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [search,     setSearch]     = useState('');
  const { flatList } = useCategories();

  // For each master item, find linked products and their avg learned rate
  const linkedProducts = (masterItemId) =>
    products.filter(p => p.masterItemId === masterItemId);

  const learnedRateFor = (masterItemId) => {
    const linked = linkedProducts(masterItemId);
    if (linked.length === 0) return null;
    const rates = linked.map(p => burnRates[p.id]).filter(Boolean);
    if (rates.length === 0) return null;
    return rates.reduce((a, b) => a + b, 0) / rates.length;
  };

  const filtered = masterItems.filter(m =>
    !search || m.name.toLowerCase().includes(search.toLowerCase())
  );

  const diverged = filtered.filter(m => {
    const manualRate = toRate(m.default_burn_qty, m.default_burn_interval_days);
    const learned    = learnedRateFor(m.id);
    const d = divergencePct(manualRate, learned);
    return d !== null && d > 20;
  });

  const handleSaveNew = async (patch) => {
    await onAddMaster(patch);
    setAddingNew(false);
  };

  const handleSaveEdit = async (patch) => {
    await onUpdateMaster(editingId, patch);
    setEditingId(null);
  };

  const handleDelete = async (id) => {
    await onDeleteMaster(id);
    setConfirmDel(null);
  };

  if (loadingMaster) return <div className={styles.empty}>Loading patterns…</div>;

  return (
    <div>
      {/* ── Toolbar ── */}
      <div className={styles.toolbar}>
        <div className={styles.toggle}>
          <button
            className={`${styles.toggleBtn} ${view === 'manual' ? styles.toggleActive : ''}`}
            onClick={() => setView('manual')}
          >My definitions</button>
          <button
            className={`${styles.toggleBtn} ${view === 'learned' ? styles.toggleActive : ''}`}
            onClick={() => setView('learned')}
          >System learned</button>
        </div>
        {diverged.length > 0 && (
          <span className={styles.divergeBadge}>
            {diverged.length} diverged
          </span>
        )}
        <input
          className={styles.searchInput}
          placeholder="Search patterns…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button className={styles.addBtn} onClick={() => { setAddingNew(true); setEditingId(null); }}>
          + Add pattern
        </button>
      </div>

      {/* ── Add new form ── */}
      {addingNew && (
        <div className={styles.addFormWrap}>
          <div className={styles.addFormTitle}>New consumption pattern</div>
          <EditForm
            item={null}
            categories={flatList}
            onSave={handleSaveNew}
            onCancel={() => setAddingNew(false)}
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          {search ? 'No patterns match your search.' : 'No patterns yet — add one above.'}
        </div>
      ) : (
        <div className={styles.table}>
          {/* Header */}
          <div className={styles.headerRow}>
            <span className={styles.colName}>Item</span>
            <span className={styles.colRate}>
              {view === 'manual' ? 'Your pattern' : 'System learned'}
            </span>
            <span className={styles.colOther}>
              {view === 'manual' ? 'System learned' : 'Your pattern'}
            </span>
            <span className={styles.colStock}>In stock</span>
            <span className={styles.colAction}></span>
          </div>

          {filtered.map(m => {
            const manualRate  = toRate(m.default_burn_qty, m.default_burn_interval_days);
            const learnedRate = learnedRateFor(m.id);
            const diff        = divergencePct(manualRate, learnedRate);
            const isDiverged  = diff !== null && diff > 20;
            const linked      = linkedProducts(m.id);
            const isEditing   = editingId === m.id;

            const manualDisplay = manualToHuman(
              m.default_burn_qty, m.default_burn_interval_days, m.unit
            );
            const learnedDisplay = rateToHuman(learnedRate, m.unit);

            const displayRate = view === 'manual' ? manualDisplay : learnedDisplay;
            const otherRate   = view === 'manual' ? learnedDisplay : manualDisplay;

            return (
              <div key={m.id}>
                <div className={`${styles.row} ${isDiverged ? styles.rowDiverged : ''}`}>
                  <div className={styles.colName}>
                    <div className={styles.itemName}>{m.name}</div>
                    <div className={styles.itemMeta}>{m.unit}</div>
                  </div>

                  <div className={styles.colRate}>
                    <span className={`${styles.rateValue} ${displayRate === '—' ? styles.rateMissing : ''}`}>
                      {displayRate}
                    </span>
                  </div>

                  <div className={styles.colOther}>
                    {otherRate !== '—' && (
                      <span className={styles.otherRate}>{otherRate}</span>
                    )}
                    {isDiverged && (
                      <span className={styles.diffBadge}>{diff}% diff</span>
                    )}
                  </div>

                  <div className={styles.colStock}>
                    {linked.length > 0 ? (
                      <span className={styles.inStockBadge}>
                        {linked.length} item{linked.length !== 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className={styles.noStock}>—</span>
                    )}
                  </div>

                  <div className={styles.colAction}>
                    {learnedRate && isDiverged && view === 'manual' && (
                      <button
                        className={styles.acceptBtn}
                        onClick={() => onAcceptLearned(m.id, learnedRate)}
                        title="Use system learned rate as your definition"
                      >Accept</button>
                    )}
                    <button
                      className={styles.editBtn}
                      onClick={() => { setEditingId(isEditing ? null : m.id); setAddingNew(false); }}
                    >
                      {isEditing ? '✕' : '✎'}
                    </button>
                    {confirmDel === m.id ? (
                      <>
                        <button className={styles.confirmDelBtn} onClick={() => handleDelete(m.id)}>
                          Delete
                        </button>
                        <button onClick={() => setConfirmDel(null)}>No</button>
                      </>
                    ) : (
                      <button className={styles.deleteBtn} onClick={() => setConfirmDel(m.id)}>
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline edit form */}
                {isEditing && (
                  <div className={styles.editFormRow}>
                    <EditForm
                      item={m}
                      categories={flatList}
                      onSave={handleSaveEdit}
                      onCancel={() => setEditingId(null)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
