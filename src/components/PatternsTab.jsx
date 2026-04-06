/**
 * PatternsTab.jsx — grouped by category, smart sort, compact rows
 */

import { useState, useMemo } from 'react';
import { useCategories } from '../hooks/useCategories';
import { UNITS } from '../constants';
import styles from './PatternsTab.module.css';

function rateToHuman(qty, interval, unit) {
  if (!qty || !interval) return '—';
  if (interval === 1) return `${qty} ${unit}/day`;
  return `${qty} ${unit} / ${interval}d`;
}

function toRate(qty, days) {
  if (!qty || !days || days <= 0) return 0;
  return parseFloat((qty / days).toFixed(4));
}

function divergencePct(manual, learned) {
  if (!manual || !learned || manual === 0) return null;
  return Math.round(Math.abs(learned - manual) / manual * 100);
}

function EditForm({ item, flatList, onSave, onCancel }) {
  const [name,     setName]     = useState(item?.name || '');
  const [catId,    setCatId]    = useState(item?.category_id ?? '');
  const [unit,     setUnit]     = useState(item?.unit || 'pc');
  const [burnQty,  setBurnQty]  = useState(item?.default_burn_qty || 1);
  const [burnDays, setBurnDays] = useState(item?.default_burn_interval_days || 7);
  const [minQty,   setMinQty]   = useState(item?.default_min_qty || 1);
  const subcats = flatList.filter(c => c.parent_id !== null);
  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      category_id: catId ? parseInt(catId) : null,
      unit,
      default_min_qty: parseFloat(minQty) || 1,
      default_burn_qty: parseFloat(burnQty) || 1,
      default_burn_interval_days: parseInt(burnDays) || 7,
    });
  };
  return (
    <div className={styles.editForm}>
      {/* Frequency — most important, shown first */}
      <div className={styles.editFormSection}>
        <div className={styles.editFormSectionLabel}>Consumption frequency</div>
        <div className={styles.burnEditRow}>
          <span className={styles.burnLbl}>I use</span>
          <input type="number" min="0.1" step="0.5" className={styles.burnNum}
            value={burnQty} onChange={e => setBurnQty(e.target.value)} />
          <div className={styles.unitInline}>
            <select value={unit} onChange={e => setUnit(e.target.value)} className={styles.unitSelect}>
              {UNITS.map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
          <span className={styles.burnLbl}>every</span>
          <input type="number" min="1" step="1" className={styles.burnNum}
            value={burnDays} onChange={e => setBurnDays(e.target.value)} />
          <span className={styles.burnLbl}>days</span>
          <span className={styles.burnCalc}>
            = {toRate(burnQty, burnDays).toFixed(3)} {unit}/day
          </span>
        </div>
      </div>
      {/* Secondary fields */}
      <div className={styles.editGrid}>
        <div className={styles.editField}>
          <label>Name</label>
          <input value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className={styles.editField}>
          <label>Safety stock min ({unit})</label>
          <input type="number" min="0" step="0.5" value={minQty}
            onChange={e => setMinQty(e.target.value)} />
        </div>
        <div className={styles.editField}>
          <label>Category</label>
          <select value={catId} onChange={e => setCatId(e.target.value)}>
            <option value="">Uncategorized</option>
            {subcats.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
      </div>
      <div className={styles.editActions}>
        <button onClick={onCancel}>Cancel</button>
        <button className={styles.saveBtn} onClick={handleSave}>Save pattern</button>
      </div>
    </div>
  );
}

function PatternRow({ m, view, linkedCount, learnedRate, isEditing, confirmDel,
  flatList, onEdit, onSave, onCancelEdit, onConfirmDel, onCancelDel, onDelete, onAcceptLearned }) {
  const manualRate = toRate(m.default_burn_qty, m.default_burn_interval_days);
  const diff       = divergencePct(manualRate, learnedRate);
  const isDiverged = diff !== null && diff > 20;
  const displayRate = view === 'manual'
    ? rateToHuman(m.default_burn_qty, m.default_burn_interval_days, m.unit)
    : (learnedRate ? rateToHuman(1, Math.max(1, Math.round(1 / learnedRate)), m.unit) : '—');

  return (
    <div>
      <div className={`${styles.row} ${linkedCount > 0 ? styles.rowLinked : ''} ${isDiverged ? styles.rowDiverged : ''}`}>
        <div className={styles.rowMain}>
          <span className={styles.rowName}>{m.name}</span>
          <span className={`${styles.rowRate} ${displayRate === '—' ? styles.rateMissing : ''}`}>
            {displayRate}
          </span>
          {isDiverged && view === 'manual' && learnedRate && (
            <span className={styles.diffPill}>{diff}% diff</span>
          )}
        </div>
        <div className={styles.rowRight}>
          {linkedCount > 0 && (
            <span className={styles.inStockPill}>{linkedCount} in stock</span>
          )}
          {isDiverged && view === 'manual' && learnedRate && (
            <button className={styles.acceptBtn} onClick={() => onAcceptLearned(m.id, learnedRate)}>
              Accept
            </button>
          )}
          <button className={styles.editBtn} onClick={onEdit}>
            {isEditing ? '✕' : '✎'}
          </button>
          {confirmDel === m.id ? (
            <>
              <button className={styles.confirmDelBtn} onClick={onDelete}>Delete</button>
              <button className={styles.cancelBtn} onClick={onCancelDel}>No</button>
            </>
          ) : (
            <button className={styles.deleteBtn} onClick={onConfirmDel}>✕</button>
          )}
        </div>
      </div>
      {isEditing && (
        <div className={styles.editFormRow}>
          <EditForm item={m} flatList={flatList} onSave={onSave} onCancel={onCancelEdit} />
        </div>
      )}
    </div>
  );
}

function CategoryGroup({ topCat, items, view, linkedProducts, burnRates,
  editingId, confirmDel, flatList, onEdit, onSaveEdit, onCancelEdit,
  onConfirmDel, onCancelDel, onDelete, onAcceptLearned }) {
  const [open, setOpen] = useState(true);
  if (items.length === 0) return null;

  const linkedCount = (id) => linkedProducts.filter(p => p.masterItemId === id).length;
  const learnedFor  = (id) => {
    const rates = linkedProducts.filter(p => p.masterItemId === id)
      .map(p => burnRates[p.id]).filter(Boolean);
    return rates.length ? rates.reduce((a, b) => a + b) / rates.length : null;
  };
  const inStockCount = items.filter(m => linkedCount(m.id) > 0).length;

  return (
    <div className={styles.catGroup}>
      <button className={styles.catHeader} onClick={() => setOpen(o => !o)}>
        <span className={styles.catIcon}>{topCat.icon}</span>
        <span className={styles.catName}>{topCat.name}</span>
        {inStockCount > 0 && (
          <span className={styles.catInStock}>{inStockCount} in stock</span>
        )}
        <span className={styles.catCount}>{items.length} items</span>
        <span className={styles.catChevron}>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className={styles.catItems}>
          {items.map(m => (
            <PatternRow
              key={m.id}
              m={m}
              view={view}
              linkedCount={linkedCount(m.id)}
              learnedRate={learnedFor(m.id)}
              isEditing={editingId === m.id}
              confirmDel={confirmDel}
              flatList={flatList}
              onEdit={() => onEdit(m.id)}
              onSave={(patch) => onSaveEdit(m.id, patch)}
              onCancelEdit={onCancelEdit}
              onConfirmDel={() => onConfirmDel(m.id)}
              onCancelDel={onCancelDel}
              onDelete={() => onDelete(m.id)}
              onAcceptLearned={onAcceptLearned}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PatternsTab({
  masterItems, loadingMaster, products, burnRates,
  onAddMaster, onUpdateMaster, onDeleteMaster, onAcceptLearned,
}) {
  const [view,       setView]       = useState('manual');
  const [editingId,  setEditingId]  = useState(null);
  const [addingNew,  setAddingNew]  = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [search,     setSearch]     = useState('');
  const { topLevel, byId, flatList } = useCategories();

  const linkedIds = useMemo(() =>
    new Set(products.map(p => p.masterItemId).filter(Boolean)),
  [products]);

  const sortItems = (items) => [...items].sort((a, b) => {
    const aL = linkedIds.has(a.id) ? 0 : 1;
    const bL = linkedIds.has(b.id) ? 0 : 1;
    if (aL !== bL) return aL - bL;
    return a.name.localeCompare(b.name);
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return masterItems.filter(m => !q || m.name.toLowerCase().includes(q));
  }, [masterItems, search]);

  const grouped = useMemo(() => {
    const g = {};
    for (const m of filtered) {
      const sub    = m.category_id ? byId(m.category_id) : null;
      const topId  = sub?.parent_id ?? sub?.id ?? 'uncategorized';
      if (!g[topId]) g[topId] = [];
      g[topId].push(m);
    }
    return g;
  }, [filtered, byId]);

  const divergedCount = filtered.filter(m => {
    const mr = toRate(m.default_burn_qty, m.default_burn_interval_days);
    const rates = products.filter(p => p.masterItemId === m.id)
      .map(p => burnRates[p.id]).filter(Boolean);
    const lr = rates.length ? rates.reduce((a, b) => a + b) / rates.length : null;
    const d = divergencePct(mr, lr);
    return d !== null && d > 20;
  }).length;

  if (loadingMaster) return <div className={styles.empty}>Loading patterns…</div>;

  return (
    <div>
      <div className={styles.toolbar}>
        <div className={styles.toggle}>
          <button className={`${styles.toggleBtn} ${view === 'manual' ? styles.toggleActive : ''}`}
            onClick={() => setView('manual')}>My definitions</button>
          <button className={`${styles.toggleBtn} ${view === 'learned' ? styles.toggleActive : ''}`}
            onClick={() => setView('learned')}>System learned</button>
        </div>
        {divergedCount > 0 && (
          <span className={styles.divergeBadge}>{divergedCount} diverged</span>
        )}
        <input className={styles.searchInput} placeholder="Search patterns…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <button className={styles.addBtn}
          onClick={() => { setAddingNew(true); setEditingId(null); }}>
          + Add pattern
        </button>
      </div>

      {addingNew && (
        <div className={styles.addFormWrap}>
          <div className={styles.addFormTitle}>New consumption pattern</div>
          <EditForm item={null} flatList={flatList}
            onSave={async (p) => { await onAddMaster(p); setAddingNew(false); }}
            onCancel={() => setAddingNew(false)} />
        </div>
      )}

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          {search ? 'No patterns match.' : 'No patterns yet — add one above.'}
        </div>
      ) : (
        <div className={styles.groups}>
          {topLevel.map(topCat => (
            <CategoryGroup
              key={topCat.id}
              topCat={topCat}
              items={sortItems(grouped[topCat.id] ?? [])}
              view={view}
              linkedProducts={products}
              burnRates={burnRates}
              editingId={editingId}
              confirmDel={confirmDel}
              flatList={flatList}
              onEdit={(id) => setEditingId(prev => prev === id ? null : id)}
              onSaveEdit={async (id, p) => { await onUpdateMaster(id, p); setEditingId(null); }}
              onCancelEdit={() => setEditingId(null)}
              onConfirmDel={(id) => setConfirmDel(id)}
              onCancelDel={() => setConfirmDel(null)}
              onDelete={async (id) => { await onDeleteMaster(id); setConfirmDel(null); setEditingId(null); }}
              onAcceptLearned={onAcceptLearned}
            />
          ))}
          {(grouped['uncategorized'] ?? []).length > 0 && (
            <CategoryGroup
              topCat={{ id: 'uncategorized', name: 'Uncategorized', icon: '📦' }}
              items={sortItems(grouped['uncategorized'])}
              view={view}
              linkedProducts={products}
              burnRates={burnRates}
              editingId={editingId}
              confirmDel={confirmDel}
              flatList={flatList}
              onEdit={(id) => setEditingId(prev => prev === id ? null : id)}
              onSaveEdit={async (id, p) => { await onUpdateMaster(id, p); setEditingId(null); }}
              onCancelEdit={() => setEditingId(null)}
              onConfirmDel={(id) => setConfirmDel(id)}
              onCancelDel={() => setConfirmDel(null)}
              onDelete={async (id) => { await onDeleteMaster(id); setConfirmDel(null); setEditingId(null); }}
              onAcceptLearned={onAcceptLearned}
            />
          )}
        </div>
      )}
    </div>
  );
}
