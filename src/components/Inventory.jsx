import { useState, useMemo } from 'react';
import { getStatus, daysLeft, stockPct, barColor, vendorOf } from '../utils';
import { useCategories } from '../hooks/useCategories';
import styles from './Inventory.module.css';

// ── Single product card ───────────────────────────────────────

function ProductCard({ p, catIcon, selectMode, selected, onToggleSelect, onEdit, onConsume, onRestock, onFinished }) {
  const st  = getStatus(p);
  const dl  = daysLeft(p);
  const v   = vendorOf(p.vendor);
  const pct = stockPct(p);
  const isUrgent = dl !== null && dl <= v.leadDays;

  return (
    <div className={`${styles.card} ${styles['card_' + st]}`}>
      <div className={styles.cardTop}>
        <span className={styles.cardEmoji}>{catIcon}</span>
        <span className={styles.cardName}>{p.name}</span>
        <span className={`${styles.statusDot} ${styles['dot_' + st]}`} />
      </div>

      <div className={styles.barWrap}>
        <div className={styles.bar} style={{ width: pct + '%', background: barColor(st) }} />
      </div>

      <div className={styles.cardMeta}>
        <span className={styles.qty}>
          <strong>{p.currentQty}</strong> {p.unit}
          <span className={styles.minHint}> / {p.minQty} min</span>
        </span>
        <span className={`${styles.badge} ${styles['badge_' + st]}`}>{st}</span>
      </div>

      <div className={styles.vendorRow}>
        <span className={styles.vendorDot} style={{ background: v.color }} />
        <span className={styles.vendorName}>{v.name}</span>
        {dl !== null && (
          <span className={`${styles.days} ${isUrgent ? styles.daysUrgent : ''}`}>
            {dl === 0 ? 'today!' : `${dl}d`}
          </span>
        )}
      </div>

      {!selectMode && (
        <div className={styles.cardActions}>
          <button className={styles.actBtn} onClick={() => onConsume(p)} title="Log use">−</button>
          <button className={`${styles.actBtn} ${styles.actRestock}`} onClick={() => onRestock(p)}>+ restock</button>
          <button className={`${styles.actBtn} ${styles.actFinished}`} onClick={() => onFinished(p)} title="Mark finished">∅</button>
          <button className={styles.actBtn} onClick={() => onEdit(p)} title="Edit">✎</button>
        </div>
      )}
      {selectMode && (
        <div className={styles.cardSelectOverlay} onClick={() => onToggleSelect(p.id)} />
      )}
    </div>
  );
}

// ── Overall merged card (combines same-name products across vendors) ──────────

function MergedCard({ name, entries, catIcon, onEdit, onConsume, onRestock, onFinished }) {
  const totalQty  = entries.reduce((s, p) => s + p.currentQty, 0);
  const totalMin  = entries.reduce((s, p) => s + p.minQty, 0);
  const worstSt   = entries.some(p => getStatus(p) === 'critical') ? 'critical'
    : entries.some(p => getStatus(p) === 'low') ? 'low' : 'ok';
  const pct       = totalMin > 0 ? Math.min(100, Math.round((totalQty / totalMin) * 100)) : 100;
  const color     = barColor(worstSt);
  const vendors   = [...new Set(entries.map(p => vendorOf(p.vendor).name))];

  return (
    <div className={`${styles.card} ${styles['card_' + worstSt]}`}>
      <div className={styles.cardTop}>
        <span className={styles.cardEmoji}>{catIcon}</span>
        <span className={styles.cardName}>{name}</span>
        <span className={`${styles.statusDot} ${styles['dot_' + worstSt]}`} />
      </div>

      <div className={styles.barWrap}>
        <div className={styles.bar} style={{ width: pct + '%', background: color }} />
      </div>

      <div className={styles.cardMeta}>
        <span className={styles.qty}>
          <strong>{parseFloat(totalQty.toFixed(2))}</strong> {entries[0].unit} total
        </span>
        <span className={`${styles.badge} ${styles['badge_' + worstSt]}`}>{worstSt}</span>
      </div>

      <div className={styles.vendorRow}>
        {entries.length > 1 && (
          <span className={styles.splitBadge}>{entries.length} vendors</span>
        )}
        <span className={styles.vendorName} style={{ flex: 1 }}>{vendors.join(', ')}</span>
      </div>

      {/* Per-vendor sub-rows */}
      {entries.length > 1 && (
        <div className={styles.subEntries}>
          {entries.map(p => {
            const v = vendorOf(p.vendor);
            return (
              <div key={p.id} className={styles.subEntry}>
                <span className={styles.subDot} style={{ background: v.color }} />
                <span className={styles.subName}>{v.name}</span>
                <span className={styles.subQty}>{p.currentQty} {p.unit}</span>
                <button className={styles.actBtnSm} onClick={() => onConsume(p)}>−</button>
                <button className={`${styles.actBtnSm} ${styles.actRestock}`} onClick={() => onRestock(p)}>+</button>
                <button className={`${styles.actBtnSm} ${styles.actFinished}`} onClick={() => onFinished(p)}>∅</button>
              </div>
            );
          })}
        </div>
      )}

      {entries.length === 1 && (
        <div className={styles.cardActions}>
          <button className={styles.actBtn} onClick={() => onConsume(entries[0])}>−</button>
          <button className={`${styles.actBtn} ${styles.actRestock}`} onClick={() => onRestock(entries[0])}>+ restock</button>
          <button className={`${styles.actBtn} ${styles.actFinished}`} onClick={() => onFinished(entries[0])}>∅</button>
          <button className={styles.actBtn} onClick={() => onEdit(entries[0])}>✎</button>
        </div>
      )}
    </div>
  );
}

// ── Sub-category block ────────────────────────────────────────

function SubCategoryBlock({ subCat, products, overallView, selectMode, selected, onToggleSelect, onEdit, onConsume, onRestock, onFinished }) {
  const [open, setOpen] = useState(true);
  // In overall view, merge products with same name
  // useMemo must be called before any early return (Rules of Hooks)
  const displayItems = useMemo(() => {
    if (!overallView) return null;
    const groups = {};
    for (const p of products) {
      const key = p.name.toLowerCase().trim();
      if (!groups[key]) groups[key] = { name: p.name, entries: [] };
      groups[key].entries.push(p);
    }
    return Object.values(groups);
  }, [products, overallView]);

  if (products.length === 0) return null;

  return (
    <div className={styles.subBlock}>
      <button className={styles.subLabel} onClick={() => setOpen(o => !o)}>
        <span>{subCat.icon} {subCat.name}</span>
        <span className={styles.subCount}>{products.length}</span>
        <span className={styles.subChevron}>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className={styles.cardGrid}>
          {overallView
            ? displayItems.map(group => (
                <MergedCard
                  key={group.name}
                  name={group.name}
                  entries={group.entries}
                  catIcon={subCat.icon || '📦'}
                  onEdit={onEdit}
                  onConsume={onConsume}
                  onRestock={onRestock}
                  onFinished={onFinished}
                />
              ))
            : products.map(p => (
                <ProductCard
                  key={p.id}
                  p={p}
                  catIcon={subCat.icon || '📦'}
                  selectMode={selectMode}
                  selected={selected}
                  onToggleSelect={onToggleSelect}
                  onEdit={onEdit}
                  onConsume={onConsume}
                  onRestock={onRestock}
                  onFinished={onFinished}
                />
              ))
          }
        </div>
      )}
    </div>
  );
}

// ── Top-level category section ────────────────────────────────

function CategorySection({ topCat, subCats, products, overallView, selectMode, selected, onToggleSelect, onEdit, onConsume, onRestock, onFinished }) {
  const [open, setOpen] = useState(true);

  const unassigned = products.filter(p =>
    p.categoryId === topCat.id ||
    (!p.categoryId && !subCats.some(s => s.id === p.categoryId))
  );

  if (products.length === 0) return null;

  return (
    <div className={styles.catSection}>
      <button className={styles.catHeader} onClick={() => setOpen(o => !o)}>
        <span className={styles.catIcon}>{topCat.icon}</span>
        <span className={styles.catName}>{topCat.name}</span>
        <span className={styles.catCount}>{products.length} item{products.length !== 1 ? 's' : ''}</span>
        <span className={styles.catChevron}>{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className={styles.catBody}>
          {subCats.map(sub => (
            <SubCategoryBlock
              key={sub.id}
              subCat={sub}
              products={products.filter(p => p.categoryId === sub.id)}
              overallView={overallView}
              selectMode={selectMode}
              selected={selected}
              onToggleSelect={onToggleSelect}
              onEdit={onEdit}
              onConsume={onConsume}
              onRestock={onRestock}
              onFinished={onFinished}
            />
          ))}
          {unassigned.length > 0 && (
            <div className={styles.cardGrid}>
              {unassigned.map(p => (
                <ProductCard
                  key={p.id}
                  p={p}
                  catIcon={topCat.icon || '📦'}
                  selectMode={selectMode}
                  selected={selected}
                  onToggleSelect={onToggleSelect}
                  onEdit={onEdit}
                  onConsume={onConsume}
                  onRestock={onRestock}
                  onFinished={onFinished}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Inventory ────────────────────────────────────────────

export default function Inventory({ products, onEdit, onConsume, onRestock, onFinished, onAdd, onBulkDelete }) {
  const [search,      setSearch]      = useState('');
  const [sort,        setSort]        = useState('status');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterVendor, setFilterVendor] = useState('all');
  const [overallView, setOverallView] = useState(true);
  const [selectMode,  setSelectMode]  = useState(false);
  const [selected,    setSelected]    = useState(new Set());
  const [confirmDel,  setConfirmDel]  = useState(false);
  const { topLevel, childrenOf, byId, loading: catsLoading } = useCategories();

  const statusOrder = { critical: 0, low: 1, ok: 2 };

  // Unique vendors present in inventory
  const vendorIds = [...new Set(products.map(p => p.vendor))];

  let shown = products.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus !== 'all' && getStatus(p) !== filterStatus) return false;
    if (filterVendor !== 'all' && p.vendor !== filterVendor) return false;
    return true;
  });

  if (sort === 'status') shown = [...shown].sort((a, b) => statusOrder[getStatus(a)] - statusOrder[getStatus(b)]);
  else if (sort === 'name') shown = [...shown].sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === 'qty')  shown = [...shown].sort((a, b) => a.currentQty - b.currentQty);

  const uncategorized = shown.filter(p => !p.categoryId || !byId(p.categoryId));

  const toggleSelect = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const selectAll  = () => setSelected(new Set(shown.map(p => p.id)));
  const clearSel   = () => setSelected(new Set());
  const exitSelect = () => { setSelectMode(false); clearSel(); setConfirmDel(false); };

  const handleBulkDelete = () => {
    onBulkDelete([...selected]);
    exitSelect();
  };

  return (
    <div>
      <div className={styles.toolbar}>
        <input
          className={styles.search}
          placeholder="Search…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select value={sort} onChange={e => setSort(e.target.value)} className={styles.filterSelect}>
          <option value="status">By status</option>
          <option value="name">By name</option>
          <option value="qty">By qty</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={styles.filterSelect}>
          <option value="all">All statuses</option>
          <option value="critical">Critical</option>
          <option value="low">Low</option>
          <option value="ok">OK</option>
        </select>
        <select value={filterVendor} onChange={e => setFilterVendor(e.target.value)} className={styles.filterSelect}>
          <option value="all">All vendors</option>
          {vendorIds.map(v => <option key={v} value={v}>{v}</option>)}
        </select>

        {/* View toggle */}
        <div className={styles.viewToggle}>
          <button
            className={`${styles.viewBtn} ${overallView ? styles.viewBtnActive : ''}`}
            onClick={() => setOverallView(true)}
          >Overall</button>
          <button
            className={`${styles.viewBtn} ${!overallView ? styles.viewBtnActive : ''}`}
            onClick={() => setOverallView(false)}
          >By vendor</button>
        </div>

        {!selectMode ? (
          <>
            <button className={styles.selectBtn} onClick={() => setSelectMode(true)}>Select</button>
            <button className={styles.addBtn} onClick={onAdd}>+ Add item</button>
          </>
        ) : (
          <div className={styles.bulkBar}>
            <button className={styles.selAllBtn} onClick={selectAll}>All ({shown.length})</button>
            <button className={styles.selAllBtn} onClick={clearSel}>None</button>
            <span className={styles.selCount}>{selected.size} selected</span>
            {!confirmDel ? (
              <button
                className={styles.bulkDeleteBtn}
                disabled={selected.size === 0}
                onClick={() => setConfirmDel(true)}
              >Delete selected</button>
            ) : (
              <>
                <span className={styles.confirmText}>Delete {selected.size} item{selected.size !== 1 ? 's' : ''}?</span>
                <button className={styles.bulkDeleteBtn} onClick={handleBulkDelete}>Confirm</button>
                <button onClick={() => setConfirmDel(false)}>Cancel</button>
              </>
            )}
            <button className={styles.exitSelectBtn} onClick={exitSelect}>✕</button>
          </div>
        )}
      </div>

      {catsLoading ? (
        <div className={styles.empty}>Loading categories…</div>
      ) : shown.length === 0 ? (
        <div className={styles.empty}>No items found</div>
      ) : (
        <div>
          {topLevel.map(topCat => {
            const subs = childrenOf(topCat.id);
            const allSubIds = subs.map(s => s.id);
            const catProducts = shown.filter(p =>
              p.categoryId === topCat.id || allSubIds.includes(p.categoryId)
            );
            return (
              <CategorySection
                key={topCat.id}
                topCat={topCat}
                subCats={subs}
                products={catProducts}
                overallView={overallView}
                selectMode={selectMode}
                selected={selected}
                onToggleSelect={toggleSelect}
                onEdit={onEdit}
                onConsume={onConsume}
                onRestock={onRestock}
                onFinished={onFinished}
              />
            );
          })}
          {uncategorized.length > 0 && (
            <CategorySection
              topCat={{ id: null, name: 'Uncategorized', icon: '📦' }}
              subCats={[]}
              products={uncategorized}
              overallView={overallView}
              selectMode={selectMode}
              selected={selected}
              onToggleSelect={toggleSelect}
              onEdit={onEdit}
              onConsume={onConsume}
              onRestock={onRestock}
              onFinished={onFinished}
            />
          )}
        </div>
      )}
    </div>
  );
}
