import { VENDORS } from '../constants';
import { getStatus, vendorOf } from '../utils';
import styles from './Vendors.module.css';

export default function Vendors({ products }) {
  return (
    <div className={styles.grid}>
      {VENDORS.map(v => {
        const items    = products.filter(p => p.vendor === v.id);
        const critical = items.filter(p => getStatus(p) === 'critical').length;
        const low      = items.filter(p => getStatus(p) === 'low').length;

        return (
          <div key={v.id} className={styles.card}>
            <div className={styles.header}>
              <div className={styles.avatar} style={{ background: v.color + '22', color: v.color }}>
                {v.name[0]}
              </div>
              <div>
                <div className={styles.vendorName}>{v.name}</div>
                <div className={styles.itemCount}>{items.length} item{items.length !== 1 ? 's' : ''} tracked</div>
              </div>
            </div>

            <div className={styles.details}>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Min order</span>
                <span className={styles.detailValue}>{v.minOrder > 0 ? `${v.minOrder}€` : 'None'}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Lead time</span>
                <span className={styles.detailValue}>{v.leadDays} day{v.leadDays !== 1 ? 's' : ''}</span>
              </div>
              {(critical > 0 || low > 0) && (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Alerts</span>
                  <span>
                    {critical > 0 && <span className={styles.badgeCritical}>{critical} critical</span>}
                    {low > 0      && <span className={styles.badgeLow}>{low} low</span>}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
