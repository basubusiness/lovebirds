import { useState } from 'react';
import { CATEGORIES } from '../constants';
import { getStatus, daysLeft, stockPct, barColor, vendorOf } from '../utils';
import styles from './Inventory.module.css';

export default function Inventory({ products, onEdit, onConsume, onRestock, onAdd }) {
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('All');
  const [sort, setSort] = useState('status');

  const activeCats = ['All', ...CATEGORIES.filter(c => products.some(p => p.cat === c))];

  let shown = products
    .filter(p => cat === 'All' || p.cat === cat)
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  const statusOrder = { critical: 0, low: 1, ok: 2 };
  if (sort === 'status') shown = [...shown].sort((a, b) => statusOrder[getStatus(a)] - statusOrder[getStatus(b)]);
  else if (sort === 'name') shown = [...shown].sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === 'qty')  shown = [...shown].sort((a, b) => a.currentQty - b.currentQty);

  return (
    <div>
      <div className={styles.toolbar}>
        <input
          className={styles.search}
          placeholder="Search…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select value={cat} onChange={e => setCat(e.target.value)} className={styles.filterSelect}>
          {activeCats.map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={sort} onChange={e => setSort(e.target.value)} className={styles.filterSelect}>
          <option value="status">By status</option>
          <option value="name">By name</option>
          <option value="qty">By qty</option>
        </select>
        <button className={styles.addBtn} onClick={onAdd}>+ Add item</button>
      </div>

      <div className={styles.tableWrap}>
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
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={5} className={styles.empty}>No items found</td>
              </tr>
            )}
            {shown.map(p => {
              const st  = getStatus(p);
              const dl  = daysLeft(p);
              const v   = vendorOf(p.vendor);
              const pct = stockPct(p);
              const isUrgent = dl !== null && dl <= v.leadDays;

              return (
                <tr key={p.id} className={styles.row}>
                  <td>
                    <div className={styles.productName}>{p.name}</div>
                    <div className={styles.productCat}>{p.cat}</div>
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
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
