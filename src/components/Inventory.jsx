import { useState } from 'react';
import { getStatus, daysLeft, stockPct, barColor, vendorOf } from '../utils';
import { useCategories } from '../hooks/useCategories';
import styles from './Inventory.module.css';

// ── Single product card ───────────────────────────────────────

function ProductCard({ p, catIcon, onEdit, onConsume, onRestock }) {
  const st  = getStatus(p);
  const dl  = daysLeft(p);
  const v   = vendorOf(p.vendor);
  const pct = stockPct(p);
  const isUrgent = dl !== null && dl <= v.leadDays;

  return (
    <div className={`${styles.card} ${styles['card_' + st]}`}>

      {/* Top row: emoji + name + status dot */}
      <div className={styles.cardTop}>
        <span className={styles.cardEmoji}>{catIcon}</span>
        <span className={styles.cardName}>{p.name}</span>
        <span className={`${styles.statusDot} ${styles['dot_' + st]}`} />
      </div>

      {/* Stock bar */}
      <div className={styles.barWrap}>
        <div
          className={styles.bar}
          style={{ width: pct + '%', background: barColor(st) }}
        />
      </div>

      {/* Qty + badge */}
      <div className={styles.cardMeta}>
        <span className={styles.qty}>
          <strong>{p.currentQty}</strong> {p.unit}
          <span className={styles.minHint}> / {p.minQty} min</span>
        </span>
        <span className={`${styles.badge} ${styles['badge_' + st]}`}>{st}</span>
      </div>

      {/* Vendor + days */}
      <div className={styles.vendorRow}>
        <span className={styles.vendorDot} style={{ background: v.color }} />
        <span className={styles.vendorName}>{v.name}</span>
        {dl !== null && (
          <span className={`${styles.days} ${isUrgent ? styles.daysUrgent : ''}`}>
            {dl === 0 ? 'today!' : `${dl}d`}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className={styles.cardActions}>
        <button className={styles.actBtn} onClick={() => onConsume(p)} title="Log use">−</button>
        <button className={`${styles.actBtn} ${styles.actRestock}`} onClick={() => onRestock(p)} title="Restock">+ restock</button>
        <button className={styles.actBtn} onClick={() => onEdit(p)} title="Edit">✎</button>
      </div>
    </div>
  );
}

// ── Sub-category block ────────────────────────────────────────

function SubCategoryBlock({ subCat, products, onEdit, onConsume, onRestock }) {
  const [open, setOpen] = useState(true);
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
          {products.map(p => (
            <ProductCard
              key={p.id}
              p={p}
              catIcon={subCat.icon || '📦'}
              onEdit={onEdit}
              onConsume={onConsume}
              onRestock={onRestock}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Top-level category section ────────────────────────────────

function CategorySection({ topCat, subCats, products, onEdit, onConsume, onRestock }) {
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
              onEdit={onEdit}
              onConsume={onConsume}
              onRestock={onRestock}
            />
          ))}

          {unassigned.length > 0 && (
            <div className={styles.cardGrid}>
              {unassigned.map(p => (
                <ProductCard
                  key={p.id}
                  p={p}
                  catIcon={topCat.icon || '📦'}
                  onEdit={onEdit}
                  onConsume={onConsume}
                  onRestock={onRestock}
                />
              ))}
            </div>
          )}
        </div>
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

  let shown = products.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  );

  if (sort === 'status') shown = [...shown].sort((a, b) => statusOrder[getStatus(a)] - statusOrder[getStatus(b)]);
  else if (sort === 'name') shown = [...shown].sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === 'qty')  shown = [...shown].sort((a, b) => a.currentQty - b.currentQty);

  const uncategorized = shown.filter(p => {
    if (!p.categoryId) return true;
    return !byId(p.categoryId);
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
                onEdit={onEdit}
                onConsume={onConsume}
                onRestock={onRestock}
              />
            );
          })}

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
