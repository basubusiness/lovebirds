import { useState, useCallback } from 'react';
import { useProducts }   from './hooks/useProducts';
import { VENDORS } from './constants';
import { getStatus, uid } from './utils';

import AuthGate, { useAuth } from './components/AuthGate';
import AccountModal from './components/AccountModal';
import Dashboard    from './components/Dashboard';
import Inventory    from './components/Inventory';
import Alerts       from './components/Alerts';
import Vendors      from './components/Vendors';
import ProductModal from './components/ProductModal';
import ReceiptModal from './components/ReceiptModal';
import { ConsumeModal, RestockModal } from './components/QuickModals';
import Toast        from './components/Toast';

import styles from './App.module.css';

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'alerts',    label: 'Alerts'    },
  { id: 'vendors',   label: 'Vendors'   },
];

// ── Inner app (rendered only when authenticated) ─────────────────────────────

function AppInner() {
  const { session, signOut }                = useAuth();
  const [products, setProducts, loading]    = useProducts();
  const [tab,      setTab]                  = useState('dashboard');
  const [modal,    setModal]                = useState(null);
  const [account,  setAccount]              = useState(false);
  const [consume,  setConsume]              = useState(null);
  const [restock,  setRestock]              = useState(null);
  const [receipt,  setReceipt]              = useState(false);
  const [toast,    setToast]                = useState(null);

  const notify = msg => setToast(msg);

  /* product CRUD */
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

  /* consumption / restock */
  const logConsume = useCallback((qty) => {
    setProducts(prev => prev.map(p =>
      p.id === consume.id
        ? { ...p, currentQty: parseFloat(Math.max(0, p.currentQty - qty).toFixed(2)) }
        : p
    ));
    notify(`Logged -${qty} ${consume.unit}`);
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

  /* receipt import */
  const handleReceiptConfirm = useCallback((parsedItems) => {
    let added = 0, updated = 0;
    setProducts(prev => {
      let next = [...prev];
      parsedItems.forEach(item => {
        const match = item.matched ? next.find(p => p.id === item.matched.id) : null;
        if (match) {
          next = next.map(p =>
            p.id === match.id
              ? { ...p, currentQty: parseFloat((p.currentQty + item.editQty).toFixed(2)) }
              : p
          );
          updated++;
        } else {
          next.push({
            id:         uid(),
            name:       item.editName,
            cat:        'Other',
            unit:       item.editUnit,
            minQty:     1,
            currentQty: item.editQty,
            vendor:     'cactus',
            burnRate:   0,
            note:       `Imported from receipt (${item.vendorGuess})`,
          });
          added++;
        }
      });
      return next;
    });
    setReceipt(false);
    notify(`Receipt imported: ${updated} updated, ${added} new item${added !== 1 ? 's' : ''}`);
  }, [setProducts]);

  const clearAll = useCallback(() => {
    setProducts([]);
  }, [setProducts]);

  const avatarUrl = session?.user?.user_metadata?.avatar_url;
  const initials  = (session?.user?.user_metadata?.full_name || session?.user?.email || '?')
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const alertCount = products.filter(p => getStatus(p) !== 'ok').length;
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div style={{ color: '#888', fontSize: '0.9rem' }}>Loading inventory…</div>
      </div>
    );
  }

  return (
    <div className={styles.app}>
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
        <div className={styles.headerActions}>
          <button className={styles.iconBtn} onClick={() => setReceipt(true)}>
            Import receipt
          </button>
          <button className={styles.avatarBtn} onClick={() => setAccount(true)} title="Account">
            {avatarUrl
              ? <img src={avatarUrl} alt="account" className={styles.avatarImg} referrerPolicy="no-referrer" />
              : <span className={styles.avatarInitials}>{initials}</span>
            }
          </button>
        </div>
      </header>

      <main className={styles.main}>
        {tab === 'dashboard' && <Dashboard products={products} vendors={VENDORS} />}
        {tab === 'inventory' && (
          <Inventory
            products={products}
            onEdit={p => setModal(p)}
            onConsume={p => setConsume(p)}
            onRestock={p => setRestock(p)}
            onAdd={() => setModal({})}
          />
        )}
        {tab === 'alerts'  && <Alerts   products={products} />}
        {tab === 'vendors' && <Vendors  products={products} />}
      </main>

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
      {receipt && (
        <ReceiptModal
          products={products}
          onConfirm={handleReceiptConfirm}
          onClose={() => setReceipt(false)}
        />
      )}

      {account && (
        <AccountModal
          products={products}
          onClearAll={clearAll}
          onClose={() => setAccount(false)}
        />
      )}

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}

// ── Root export — wraps everything in AuthGate ───────────────────────────────

export default function App() {
  return (
    <AuthGate>
      <AppInner />
    </AuthGate>
  );
}
