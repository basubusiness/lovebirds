import { getStatus, daysLeft, vendorOf } from '../utils';
import styles from './Dashboard.module.css';

function MetricCard({ label, value, colorClass }) {
  return (
    <div className={`${styles.metric} ${colorClass || ''}`}>
      <div className={styles.metricLabel}>{label}</div>
      <div className={styles.metricValue}>{value}</div>
    </div>
  );
}

export default function Dashboard({ products, vendors }) {
  const total    = products.length;
  const critical = products.filter(p => getStatus(p) === 'critical').length;
  const low      = products.filter(p => getStatus(p) === 'low').length;
  const ok       = total - critical - low;

  const alerts = products
    .filter(p => getStatus(p) !== 'ok')
    .sort((a, b) => (getStatus(a) === 'critical' ? -1 : 1));

  return (
    <div>
      <div className={styles.metricsGrid}>
        <MetricCard label="Total items"   value={total}    />
        <MetricCard label="Critical"      value={critical} colorClass={styles.metricCritical} />
        <MetricCard label="Low stock"     value={low}      colorClass={styles.metricLow} />
        <MetricCard label="Well stocked"  value={ok}       colorClass={styles.metricOk} />
      </div>

      {alerts.length > 0 && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>Action needed</div>
          {alerts.map(p => {
            const st = getStatus(p);
            const dl = daysLeft(p);
            const v  = vendorOf(p.vendor);
            return (
              <div key={p.id} className={`${styles.alertRow} ${styles[st]}`}>
                <div className={styles.alertInfo}>
                  <div className={styles.alertName}>{p.name}</div>
                  <div className={styles.alertSub}>
                    {p.currentQty} {p.unit} remaining · via {v.name}
                    {dl !== null && ` · ~${dl}d left`}
                  </div>
                </div>
                <span className={`${styles.badge} ${styles['badge_' + st]}`}>{st}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className={styles.card}>
        <div className={styles.cardTitle}>Vendor overview</div>
        {vendors.map(v => {
          const items = products.filter(p => p.vendor === v.id);
          if (!items.length) return null;
          const crit = items.filter(p => getStatus(p) === 'critical').length;
          return (
            <div key={v.id} className={styles.vendorRow}>
              <span className={styles.vendorDot} style={{ background: v.color }} />
              <span className={styles.vendorName}>{v.name}</span>
              <span className={styles.chip}>{items.length} item{items.length > 1 ? 's' : ''}</span>
              {crit > 0 && <span className={`${styles.badge} ${styles.badge_critical}`}>{crit} critical</span>}
              {v.minOrder > 0 && <span className={styles.minOrder}>{v.minOrder}€ min</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
