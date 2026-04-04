import { getStatus, daysLeft, needsOrder, vendorOf } from '../utils';
import styles from './Alerts.module.css';

export default function Alerts({ products }) {
  const toOrder = products
    .filter(p => needsOrder(p) || getStatus(p) !== 'ok')
    .sort((a, b) => {
      const da = daysLeft(a) ?? 999;
      const db = daysLeft(b) ?? 999;
      return da - db;
    });

  // Group by vendor
  const byVendor = {};
  toOrder.forEach(p => {
    if (!byVendor[p.vendor]) byVendor[p.vendor] = [];
    byVendor[p.vendor].push(p);
  });

  if (toOrder.length === 0) {
    return (
      <div className={styles.allGood}>
        <div className={styles.checkmark}>✓</div>
        <div className={styles.allGoodTitle}>All stocked up</div>
        <div className={styles.allGoodSub}>Nothing needs ordering right now.</div>
      </div>
    );
  }

  return (
    <div>
      <p className={styles.intro}>
        {toOrder.length} item{toOrder.length > 1 ? 's' : ''} need attention —
        grouped by vendor to help batch your orders.
      </p>

      {Object.entries(byVendor).map(([vid, items]) => {
        const v = vendorOf(vid);
        return (
          <div key={vid} className={styles.vendorCard}>
            <div className={styles.vendorHeader}>
              <span className={styles.vendorDot} style={{ background: v.color }} />
              <span className={styles.vendorName}>{v.name}</span>
              {v.minOrder > 0 && (
                <span className={styles.chip}>{v.minOrder}€ min order</span>
              )}
              <span className={styles.leadTime}>{v.leadDays}d lead time</span>
            </div>

            {items.map((p, i) => {
              const st = getStatus(p);
              const dl = daysLeft(p);
              return (
                <div key={p.id} className={`${styles.itemRow} ${i === items.length - 1 ? styles.lastRow : ''}`}>
                  <div className={styles.itemInfo}>
                    <div className={styles.itemName}>{p.name}</div>
                    <div className={styles.itemSub}>
                      {p.currentQty} {p.unit} left
                      {dl !== null && (
                        <span className={dl === 0 ? styles.urgent : ''}>
                          {' '}· {dl === 0 ? 'order today' : `~${dl}d left`}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={`${styles.badge} ${styles['badge_' + st]}`}>{st}</span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
