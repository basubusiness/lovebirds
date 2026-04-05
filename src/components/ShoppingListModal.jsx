/**
 * ShoppingListModal.jsx
 *
 * Shows what to buy from a specific vendor before their next shop date.
 * Items included:
 *   1. Already below minQty (critical/low)
 *   2. Forecasted to run out before next shop date (based on burn rate)
 *
 * Also supports "Ad hoc order" mode (no scheduled date — just what's needed now).
 */

import Modal from './Modal';
import { getStatus, daysLeft } from '../utils';
import styles from './ShoppingListModal.module.css';

function fmt(date) {
  if (!date) return 'unscheduled';
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function neededQty(p) {
  return Math.max(0, parseFloat((p.minQty - p.currentQty).toFixed(2)));
}

function willRunOutBefore(p, targetDate) {
  if (!targetDate || !p.burnRate || p.burnRate <= 0) return false;
  const daysToEmpty = p.currentQty / p.burnRate;
  const daysToShop  = (targetDate.getTime() - Date.now()) / 86400000;
  return daysToEmpty < daysToShop;
}

export default function ShoppingListModal({ vendor, products, nextDate, isAdHoc, onClose }) {
  const vendorProducts = products.filter(p => p.vendor === vendor.id);

  // Items already low/critical
  const alreadyNeeded = vendorProducts.filter(p => getStatus(p) !== 'ok');

  // Items that will run out before next shop (not already in alreadyNeeded)
  const forecastNeeded = vendorProducts.filter(p =>
    getStatus(p) === 'ok' &&
    willRunOutBefore(p, nextDate)
  );

  const allItems = [
    ...alreadyNeeded.map(p => ({ ...p, reason: 'low' })),
    ...forecastNeeded.map(p => ({ ...p, reason: 'forecast' })),
  ];

  const totalItems = allItems.length;

  return (
    <Modal
      title={isAdHoc ? `Ad hoc order — ${vendor.name}` : `Shopping list — ${vendor.name}`}
      onClose={onClose}
      maxWidth={460}
    >
      <div className={styles.header}>
        <span className={styles.headerDot} style={{ background: vendor.color }} />
        <span className={styles.headerDate}>
          {isAdHoc ? 'One-off order' : `Next shop: ${fmt(nextDate)}`}
        </span>
        <span className={styles.headerCount}>{totalItems} item{totalItems !== 1 ? 's' : ''}</span>
      </div>

      {totalItems === 0 ? (
        <div className={styles.empty}>
          Nothing needed from {vendor.name} right now. 
        </div>
      ) : (
        <div className={styles.list}>
          {alreadyNeeded.length > 0 && (
            <>
              <div className={styles.sectionLabel}>Needed now</div>
              {alreadyNeeded.map(p => {
                const st  = getStatus(p);
                const qty = neededQty(p);
                return (
                  <div key={p.id} className={styles.item}>
                    <div className={styles.itemLeft}>
                      <span className={`${styles.dot} ${styles['dot_' + st]}`} />
                      <div>
                        <div className={styles.itemName}>{p.name}</div>
                        <div className={styles.itemSub}>
                          {p.currentQty} {p.unit} left · min {p.minQty}
                        </div>
                      </div>
                    </div>
                    <div className={styles.itemQty}>
                      {qty > 0 ? `+${qty} ${p.unit}` : 'restock'}
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {forecastNeeded.length > 0 && (
            <>
              <div className={styles.sectionLabel}>Running out before next shop</div>
              {forecastNeeded.map(p => {
                const dl  = daysLeft(p);
                const qty = neededQty(p) || p.minQty;
                return (
                  <div key={p.id} className={styles.item}>
                    <div className={styles.itemLeft}>
                      <span className={`${styles.dot} ${styles.dot_forecast}`} />
                      <div>
                        <div className={styles.itemName}>{p.name}</div>
                        <div className={styles.itemSub}>
                          {p.currentQty} {p.unit} left
                          {dl !== null ? ` · ~${dl}d remaining` : ''}
                        </div>
                      </div>
                    </div>
                    <div className={styles.itemQty}>+{qty} {p.unit}</div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
