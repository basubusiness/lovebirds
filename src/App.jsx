import { useState, useCallback } from 'react';
import { useProducts }        from './hooks/useProducts';
import { useImports }         from './hooks/useImports';
import { useConsumptionLog }  from './hooks/useConsumptionLog';
import { useVendorSchedules } from './hooks/useVendorSchedules';
import { VENDORS }            from './constants';
import { getStatus, uid }     from './utils';

import AuthGate, { useAuth }  from './components/AuthGate';
import AccountModal           from './components/AccountModal';
import Dashboard              from './components/Dashboard';
import Inventory              from './components/Inventory';
import Alerts                 from './components/Alerts';
import Vendors                from './components/Vendors';
import ProductModal           from './components/ProductModal';
import ReceiptModal           from './components/ReceiptModal';
import ImportsModal           from './components/ImportsModal';
import SettingsModal          from './components/SettingsModal';
import { ConsumeModal, RestockModal, FinishedModal } from './components/QuickModals';
import Toast                  from './components/Toast';

import styles from './App.module.css';

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'alerts',    label: 'Alerts'    },
  { id: 'vendors',   label: 'Vendors'   },
];

function AppInner() {
  const { session }                           = useAuth();
  const [products, setProducts, loading]      = useProducts();
  const { imports, loading: importsLoading,
          saveImport, deleteImport,
          updateImport }                      = useImports();
  const { burnRates, appendLog }              = useConsumptionLog();
  const { schedules, upsertSchedule }         = useVendorSchedules();

  const [tab,      setTab]      = useState('dashboard');
  const [modal,    setModal]    = useState(null);
  const [account,  setAccount]  = useState(false);
  const [consume,  setConsume]  = useState(null);
  const [restock,  setRestock]  = useState(null);
  const [finished, setFinished] = useState(null);
  const [receipt,  setReceipt]  = useState(false);
  const [history,  setHistory]  = useState(false);
  const [settings, setSettings] = useState(false);
  const [toast,    setToast]    = useState(null);

  const notify = msg => setToast(msg);

  // Merge computed burn rates into products (EWMA from log overrides manual
  // only when there's enough data — manual stays as fallback)
  const productsWithBurnRates = products.map(p => ({
    ...p,
    burnRate: burnRates[p.id] ?? p.burnRate,
  }));

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

  /* consume — logs to DB, updates qty */
  const logConsume = useCallback(async (qty) => {
    const p = consume;
    setProducts(prev => prev.map(x =>
      x.id === p.id
        ? { ...x, currentQty: parseFloat(Math.max(0, x.currentQty - qty).toFixed(2)) }
        : x
    ));
    await appendLog(p.id, -qty, 'consume');
    notify(`Logged −${qty} ${p.unit}`);
    setConsume(null);
  }, [consume, setProducts, appendLog]);

  /* restock — logs to DB, updates qty */
  const logRestock = useCallback(async (qty) => {
    const p = restock;
    setProducts(prev => prev.map(x =>
      x.id === p.id
        ? { ...x, currentQty: parseFloat((x.currentQty + qty).toFixed(2)) }
        : x
    ));
    await appendLog(p.id, qty, 'restock');
    notify(`Added +${qty} ${p.unit}`);
    setRestock(null);
  }, [restock, setProducts, appendLog]);

  /* finished — sets qty to 0, logs full delta, recalibrates burn rate */
  const logFinished = useCallback(async (qty) => {
    const p = finished;
    setProducts(prev => prev.map(x =>
      x.id === p.id ? { ...x, currentQty: 0 } : x
    ));
    await appendLog(p.id, -qty, 'finished');
    notify(`${p.name} marked as finished`);
    setFinished(null);
  }, [finished, setProducts, appendLog]);

  /* receipt import */
  const handleReceiptConfirm = useCallback(async (parsedItems) => {
    let added = 0, updated = 0;
    const historyItems = [];

    parsedItems.forEach(item => {
      historyItems.push({
        product_id: item.matched?.id ?? null,
        name:       item.editName,
        qty:        item.editQty,
        unit:       item.editUnit,
        is_new:     !item.matched,
      });
    });

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
            categoryId: null,
            unit:       item.editUnit,
            minQty:     1,
            currentQty: item.editQty,
            vendor:     item.batchVendor || 'cactus',
            burnRate:   0,
            note:       '',
          });
          added++;
        }
      });
      return next;
    });

    const vendor       = parsedItems[0]?.batchVendor ?? '';
    const purchaseDate = parsedItems[0]?.batchDate ?? new Date().toISOString().slice(0, 10);
    saveImport({ vendor, purchaseDate, items: historyItems });

    setReceipt(false);
    notify(`Receipt imported: ${updated} updated, ${added} new item${added !== 1 ? 's' : ''}`);
  }, [setProducts, saveImport]);

  const clearAll = useCallback(() => setProducts([]), [setProducts]);

  const avatarUrl = session?.user?.user_metadata?.avatar_url;
  const initials  = (session?.user?.user_metadata?.full_name || session?.user?.email || '?')
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const alertCount = productsWithBurnRates.filter(p => getStatus(p) !== 'ok').length;

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>
        <div style={{ color:'#888', fontSize:'0.9rem' }}>Loading inventory…</div>
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
          <button className={styles.iconBtn} onClick={() => setHistory(true)}>
            History{imports.length > 0 && <span className={styles.historyCount}> ({imports.length})</span>}
          </button>
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
        {tab === 'dashboard' && (
          <Dashboard
            products={productsWithBurnRates}
            vendors={VENDORS}
            schedules={schedules}
            onOpenSettings={() => setSettings(true)}
          />
        )}
        {tab === 'inventory' && (
          <Inventory
            products={productsWithBurnRates}
            onEdit={p => setModal(p)}
            onConsume={p => setConsume(p)}
            onRestock={p => setRestock(p)}
            onFinished={p => setFinished(p)}
            onAdd={() => setModal({})}
          />
        )}
        {tab === 'alerts'  && <Alerts   products={productsWithBurnRates} />}
        {tab === 'vendors' && <Vendors  products={productsWithBurnRates} />}
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
      {finished && (
        <FinishedModal product={finished} onSave={logFinished} onClose={() => setFinished(null)} />
      )}
      {receipt && (
        <ReceiptModal
          products={productsWithBurnRates}
          onConfirm={handleReceiptConfirm}
          onClose={() => setReceipt(false)}
        />
      )}
      {history && (
        <ImportsModal
          imports={imports}
          loading={importsLoading}
          onDelete={deleteImport}
          onUpdate={updateImport}
          onClose={() => setHistory(false)}
        />
      )}
      {settings && (
        <SettingsModal
          schedules={schedules}
          onSave={upsertSchedule}
          onClose={() => setSettings(false)}
        />
      )}
      {account && (
        <AccountModal
          products={productsWithBurnRates}
          onClearAll={clearAll}
          onClose={() => setAccount(false)}
        />
      )}

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}

export default function App() {
  return (
    <AuthGate>
      <AppInner />
    </AuthGate>
  );
}
