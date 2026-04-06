import { useState, useCallback } from 'react';
import { useProducts }        from './hooks/useProducts';
import { useImports }         from './hooks/useImports';
import { useConsumptionLog }  from './hooks/useConsumptionLog';
import { useVendorSchedules } from './hooks/useVendorSchedules';
import { useMasterItems }     from './hooks/useMasterItems';

import { getStatus, uid }     from './utils';

import AuthGate, { useAuth }  from './components/AuthGate';
import AccountModal           from './components/AccountModal';
import Dashboard              from './components/Dashboard';
import Inventory              from './components/Inventory';
import Alerts                 from './components/Alerts';
import Vendors                from './components/Vendors';
import PatternsTab            from './components/PatternsTab';
import ProductModal           from './components/ProductModal';
import ReceiptModal           from './components/ReceiptModal';
import ImportsModal           from './components/ImportsModal';
import SettingsModal          from './components/SettingsModal';
import QuickEditModal         from './components/QuickEditModal';
import { ConsumeModal, RestockModal, FinishedModal } from './components/QuickModals';
import Toast                  from './components/Toast';

import styles from './App.module.css';

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'alerts',    label: 'Alerts'    },
  { id: 'vendors',   label: 'Vendors'   },
  { id: 'patterns',  label: 'Patterns'  },
];

function AppInner() {
  const { session }                           = useAuth();
  const [products, setProducts, loading]      = useProducts();
  const { imports, loading: importsLoading,
          saveImport, deleteImport,
          updateImport }                      = useImports();
  const { burnRates, appendLog }              = useConsumptionLog();
  const { schedules, upsertSchedule }         = useVendorSchedules();
  const { items: masterItems,
          loading: masterLoading,
          addMasterItem,
          updateMasterItem,
          deleteMasterItem }              = useMasterItems();

  const [tab,      setTab]      = useState('dashboard');
  const [modal,    setModal]    = useState(null);
  const [quickEdit, setQuickEdit] = useState(null); // product for quick-edit modal
  const [account,  setAccount]  = useState(false);
  const [consume,  setConsume]  = useState(null);
  const [restock,  setRestock]  = useState(null);
  const [finished, setFinished] = useState(null);
  const [receipt,  setReceipt]  = useState(false);
  const [history,  setHistory]  = useState(false);
  const [settings, setSettings] = useState(false);
  const [toast,    setToast]    = useState(null);

  const notify = msg => setToast(msg);

  // Merge EWMA burn rates into products (falls back to manual if no log data)
  const productsWithBurnRates = products.map(p => ({
    ...p,
    burnRate: burnRates[p.id] ?? p.burnRate,
  }));

  /* ── product CRUD ── */
  const saveProduct = useCallback((p) => {
    setProducts(prev => {
      const idx = prev.findIndex(x => x.id === p.id);
      if (idx >= 0) { const n = [...prev]; n[idx] = p; return n; }
      return [...prev, { ...p, id: p.id || uid() }];
    });
    setModal(null);
    notify(p.id && products.find(x => x.id === p.id) ? 'Product updated' : 'Product added');
  }, [setProducts, products]);

  const deleteProduct = useCallback((id) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    setModal(null);
    notify('Product removed');
  }, [setProducts]);

  const bulkDeleteProducts = useCallback((ids) => {
    const idSet = new Set(ids);
    setProducts(prev => prev.filter(p => !idSet.has(p.id)));
    notify(`Deleted ${ids.length} item${ids.length !== 1 ? 's' : ''}`);
  }, [setProducts]);

  /* ── Accept learned rate — updates master item pattern ── */
  const acceptLearnedRate = useCallback(async (masterItemId, learnedRate) => {
    const intervalDays = Math.max(1, Math.round(1 / learnedRate));
    await updateMasterItem(masterItemId, {
      default_burn_qty:              1,
      default_burn_interval_days:    intervalDays,
    });
    notify('Pattern updated from system learning');
  }, [updateMasterItem]);

  /* ── consume / restock / finished ── */
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

  const logFinished = useCallback(async (qty) => {
    const p = finished;
    setProducts(prev => prev.map(x =>
      x.id === p.id ? { ...x, currentQty: 0 } : x
    ));
    await appendLog(p.id, -qty, 'finished');
    notify(`${p.name} marked as finished`);
    setFinished(null);
  }, [finished, setProducts, appendLog]);

  /* ── receipt import ── */
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
              ? {
                  ...p,
                  currentQty: parseFloat((p.currentQty + item.editQty).toFixed(2)),
                  // Update name to English canonical if user kept the suggested translation
                  name: item.editName || p.name,
                  // Update category if user set one in the confirm screen
                  categoryId: item.editCategoryId ?? p.categoryId,
                }
              : p
          );
          updated++;
        } else {
          // Try to link new product to a master item by name
          const qTokens = (item.editName || '').toLowerCase().split(/\s+/);
          const masterMatch = masterItems.find(m => {
            const mTokens = m.name.toLowerCase().split(/\s+/);
            const inter = qTokens.filter(t => mTokens.includes(t)).length;
            const union = new Set([...qTokens, ...mTokens]).size;
            return union > 0 && inter / union >= 0.4;
          });
          next.push({
            id:                     uid(),
            name:                   item.editName,
            cat:                    'Other',
            categoryId:             item.editCategoryId ?? masterMatch?.category_id ?? null,
            unit:                   item.editUnit,
            minQty:                 masterMatch?.default_min_qty ?? 1,
            currentQty:             item.editQty,
            vendor:                 item.batchVendor || 'cactus',
            burnRate:               masterMatch
              ? (masterMatch.default_burn_qty / masterMatch.default_burn_interval_days)
              : 0,
            manualBurnQty:          masterMatch?.default_burn_qty ?? null,
            manualBurnIntervalDays: masterMatch?.default_burn_interval_days ?? null,
            masterItemId:           masterMatch?.id ?? null,
            note:                   '',
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
  }, [setProducts, saveImport, masterItems]);

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
            schedules={schedules}
            onOpenSettings={() => setSettings(true)}
          />
        )}
        {tab === 'inventory' && (
          <Inventory
            products={productsWithBurnRates}
            onEdit={p => setQuickEdit(p)}
            onConsume={p => setConsume(p)}
            onRestock={p => setRestock(p)}
            onFinished={p => setFinished(p)}
            onAdd={() => setModal({})}
            onBulkDelete={bulkDeleteProducts}
          />
        )}
        {tab === 'alerts'   && <Alerts  products={productsWithBurnRates} />}
        {tab === 'vendors'  && <Vendors products={productsWithBurnRates} />}
        {tab === 'patterns' && (
          <PatternsTab
            masterItems={masterItems}
            loadingMaster={masterLoading}
            products={productsWithBurnRates}
            burnRates={burnRates}
            onAddMaster={addMasterItem}
            onUpdateMaster={updateMasterItem}
            onDeleteMaster={deleteMasterItem}
            onAcceptLearned={acceptLearnedRate}
          />
        )}
      </main>

      {/* ── Modals ── */}
      {modal !== null && (
        <ProductModal
          product={modal?.id ? modal : null}
          masterItems={masterItems}
          loadingMaster={masterLoading}
          learnedRate={modal?.id ? burnRates[modal.id] : null}
          onSave={saveProduct}
          onDelete={deleteProduct}
          onClose={() => setModal(null)}
          onAcceptLearned={(rate) => {
            acceptLearnedRate(modal.id, rate);
            setModal(null);
          }}
        />
      )}
      {quickEdit && (
        <QuickEditModal
          product={quickEdit}
          learnedRate={burnRates[quickEdit.id]}
          onSave={(updated) => { saveProduct(updated); setQuickEdit(null); }}
          onFullEdit={() => { setModal(quickEdit); setQuickEdit(null); }}
          onClose={() => setQuickEdit(null)}
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
          masterItems={masterItems}
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
