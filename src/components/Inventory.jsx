import { useState } from 'react';
import { getStatus, daysLeft, stockPct, barColor, vendorOf } from '../utils';
import { useCategories } from '../hooks/useCategories';
import styles from './Inventory.module.css';

// ── Single product row ────────────────────────────────────────

function ProductRow({ p, onEdit, onConsume, onRestock }) {
  const st  = getStatus(p);
  const dl  = daysLeft(p);
  const v   = vendorOf(p.vendor);
  const pct = stockPct(p);
  const isUrgent = dl !== null && dl <= v.leadDays;

  return (
    <tr className={styles.row}>
      <td>
        <div className={styles.productName}>{p.name}</div>
      </td>
      <td className={styles.stockCell}>
        <div className={styles.stockTop}>
          <span>{p.currentQty} {p.unit}</span>
          <span className={`${styles.badge} ${styles['badge_' + st]}`}>{st}</span>
        </div>
        <div className={styles.barWrap}>
          <div className={styles.bar} style={{ width: pct + '%', background: barColor(st) }} />
        </div>
        <div className={styles.minLabel}>min {p.minQty} {p.unit}</div>
      </td>
      <td>
        <div className={styles.vendorCell}>
          <span className={styles.vendorDot} style={{ background: v.color }} />
          <span className={styles.vendorName}>{v.name}</span>
        </div>
      </td>
      <td className={isUrgent ? styles.urgent : ''}>
        {dl !== null ? (dl === 0 ? 'Today!' : `${dl}d`) : '—'}
      </td>
      <td>
        <div className={styles.actions}>
          <button className={styles.actionBtn} onClick={() => onConsume(p)} title="Log use">−</button>
          <button className={`${styles.actionBtn} ${styles.actionRestock}`} onClick={() => onRestock(p)} title="Restock">+</button>
          <button className={styles.actionBtn} onClick={() => onEdit(p)} title="Edit">✎</button>
        </div>
      </td>
    </tr>
  );
}

// ── Sub-category block ────────────────────────────────────────

function SubCategoryBlock({ subCat, products, onEdit, onConsume, onRestock }) {
  const [open, setOpen] = useState(true);
  if (products.length === 0) return null;

  return (
    <tbody>
      <tr className={styles.subCatRow}>
        <td colSpan={5}>
          <button className={styles.subCatToggle} onClick={() => setOpen(o => !o)}>
            <span className={styles.subCatChevron}>{open ? '▾' : '▸'}</span>
            <span className={styles.subCatName}>{subCat.icon} {subCat.name}</span>
            <span className={styles.subCatCount}>{products.length}</span>
          </button>
        </td>
      </tr>
      {open && products.map(p => (
        <ProductRow key={p.id} p={p} onEdit={onEdit} onConsume={onConsume} onRestock={onRestock} />
      ))}
    </tbody>
  );
}

// ── Top-level category section ────────────────────────────────

function CategorySection({ topCat, subCats, products, onEdit, onConsume, onRestock }) {
  const [open, setOpen] = useState(true);

  // Products directly under this top-level cat with no sub-category
  const unassigned = products.filter(p =>
    p.categoryId === topCat.id ||
    (!p.categoryId && !subCats.some(s => s.id === p.categoryId))
  );

  const hasAnything = products.length > 0;
  if (!hasAnything) return null;

  return (
    <div className={styles.categorySection}>
      <button className={styles.catHeader} onClick={() => setOpen(o => !o)}>
        <span className={styles.catIcon}>{topCat.icon}</span>
        <span className={styles.catName}>{topCat.name}</span>
        <span className={styles.catCount}>{products.length} item{products.length !== 1 ? 's' : ''}</span>
        <span className={styles.catChevron}>{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Product</th>
              <th>Stock</th>
              <th>Vendor</th>
              <th>Days left</th>
              <th></th>
            </tr>
          </thead>

          {/* Sub-category groups */}
          {subCats.map(sub => (
            <SubCategoryBlock
              key={sub.id}
              subCat={sub}
              products={products.filter(p => p.categoryId === sub.id)}
              onEdit={onEdit}
              onConsume={onConsume}
              onRestock={onRestock}
            />
          ))}

          {/* Unassigned items directly under top-level */}
          {unassigned.length > 0 && (
            <tbody>
              {unassigned.map(p => (
                <ProductRow key={p.id} p={p} onEdit={onEdit} onConsume={onConsume} onRestock={onRestock} />
              ))}
            </tbody>
          )}
        </table>
      )}
    </div>
  );
}

// ── Main Inventory component ──────────────────────────────────

export default function Inventory({ products, onEdit, onConsume, onRestock, onAdd }) {
  const [search, setSearch] = useState('');
  const [sort,   setSort]   = useState('status');
  const { topLevel, childrenOf, byId, loading: catsLoading } = useCategories();

  const statusOrder = { critical: 0, low: 1, ok: 2 };

  // Filter by search
  let shown = products.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  );

  // Sort within each group
  if (sort === 'status') shown = [...shown].sort((a, b) => statusOrder[getStatus(a)] - statusOrder[getStatus(b)]);
  else if (sort === 'name') shown = [...shown].sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === 'qty')  shown = [...shown].sort((a, b) => a.currentQty - b.currentQty);

  // Products with no category at all → "Other"
  const uncategorized = shown.filter(p => {
    if (!p.categoryId) return true;
    return !byId(p.categoryId); // category was deleted
  });

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
        <button className={styles.addBtn} onClick={onAdd}>+ Add item</button>
      </div>

      {catsLoading ? (
        <div className={styles.empty}>Loading categories…</div>
      ) : shown.length === 0 ? (
        <div className={styles.empty}>No items found</div>
      ) : (
        <div className={styles.tableWrap}>
          {/* Render each top-level category */}
          {topLevel.map(topCat => {
            const subs = childrenOf(topCat.id);
            const allSubIds = subs.map(s => s.id);
            // All products belonging to this top-level tree
            const catProducts = shown.filter(p =>
              p.categoryId === topCat.id || allSubIds.includes(p.categoryId)
            );
            return (
              <CategorySection
                key={topCat.id}
                topCat={topCat}
                subCats={subs}
                products={catProducts}
                onEdit={onEdit}
                onConsume={onConsume}
                onRestock={onRestock}
              />
            );
          })}

          {/* Uncategorized items */}
          {uncategorized.length > 0 && (
            <CategorySection
              topCat={{ id: null, name: 'Uncategorized', icon: '📦' }}
              subCats={[]}
              products={uncategorized}
              onEdit={onEdit}
              onConsume={onConsume}
              onRestock={onRestock}
            />
          )}
        </div>
      )}
    </div>
  );
}
