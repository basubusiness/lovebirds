import { useState, useCallback } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { VENDORS, SEED_PRODUCTS } from './constants';
import { getStatus, uid } from './utils';

import Dashboard    from './components/Dashboard';
import Inventory    from './components/Inventory';
import Alerts       from './components/Alerts';
import Vendors      from './components/Vendors';
import ProductModal from './components/ProductModal';
import { ConsumeModal, RestockModal } from './components/QuickModals';
import Toast        from './components/Toast';

import styles from './App.module.css';

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'alerts',    label: 'Alerts'    },
  { id: 'vendors',   label: 'Vendors'   },
];

export default function App() {
  const [products, setProducts] = useLocalStorage('hirt_products', SEED_PRODUCTS);
  const [tab,      setTab]      = useState('dashboard');
  const [modal,    setModal]    = useState(null);   // null | {} (new) | product (edit)
  const [consume,  setConsume]  = useState(null);
  const [restock,  setRestock]  = useState(null);
  const [toast,    setToast]    = useState(null);

  const notify = msg => setToast(msg);

  /* ── product CRUD ─────────────────────────────────── */
  const saveProduct = useCallback((p) => {
    setProducts(prev => {
      const idx = prev.findIndex(x => x.id === p.id);
      if (idx >= 0) { const n = [...prev]; n[idx] = p; return n; }
      return [...prev, { ...p, id: uid() }];
    });
    setModal(null);
    notify(modal?.id ? 'Product updated' : 'Product added');
  }, [modal, setProducts]);

  const deleteProduct = useCallback((id) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    setModal(null);
    notify('Product removed');
  }, [setProducts]);

  /* ── consumption / restock ────────────────────────── */
  const logConsume = useCallback((qty) => {
    setProducts(prev => prev.map(p =>
      p.id === consume.id
        ? { ...p, currentQty: parseFloat(Math.max(0, p.currentQty - qty).toFixed(2)) }
        : p
    ));
    notify(`Logged −${qty} ${consume.unit}`);
    setConsume(null);
  }, [consume, setProducts]);

  const logRestock = useCallback((qty) => {
    setProducts(prev => prev.map(p =>
      p.id === restock.id
        ? { ...p, currentQty: parseFloat((p.currentQty + qty).toFixed(2)) }
        : p
    ));
    notify(`Added +${qty} ${restock.unit}`);
    setRestock(null);
  }, [restock, setProducts]);

  /* ── alert badge count ────────────────────────────── */
  const alertCount = products.filter(p => getStatus(p) !== 'ok').length;

  return (
    <div className={styles.app}>
      {/* ── Top nav ──────────────────────────────────── */}
      <header className={styles.header}>
        <div className={styles.logo}>HIRT</div>
        <nav className={styles.nav}>
          {TABS.map(t => (
            <button
              key={t.id}
              className={`${styles.navBtn} ${tab === t.id ? styles.navActive : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {t.id === 'alerts' && alertCount > 0 && (
                <span className={styles.alertBadge}>{alertCount}</span>
              )}
            </button>
          ))}
        </nav>
      </header>

      {/* ── Main content ─────────────────────────────── */}
      <main className={styles.main}>
        {tab === 'dashboard' && <Dashboard products={products} vendors={VENDORS} />}
        {tab === 'inventory' && (
          <Inventory
            products={products}
            onEdit={p  => setModal(p)}
            onConsume={p => setConsume(p)}
            onRestock={p => setRestock(p)}
            onAdd={() => setModal({})}
          />
        )}
        {tab === 'alerts'    && <Alerts   products={products} />}
        {tab === 'vendors'   && <Vendors  products={products} />}
      </main>

      {/* ── Modals ───────────────────────────────────── */}
      {modal !== null && (
        <ProductModal
          product={modal?.id ? modal : null}
          onSave={saveProduct}
          onDelete={deleteProduct}
          onClose={() => setModal(null)}
        />
      )}
      {consume && (
        <ConsumeModal product={consume} onSave={logConsume} onClose={() => setConsume(null)} />
      )}
      {restock && (
        <RestockModal product={restock} onSave={logRestock} onClose={() => setRestock(null)} />
      )}

      {/* ── Toast ────────────────────────────────────── */}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
