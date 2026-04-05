import Modal from './Modal';
import { useAuth } from './AuthGate';
import styles from './AccountModal.module.css';

export default function AccountModal({ products, onClearAll, onClose }) {
  const { session, signOut } = useAuth();
  const user = session?.user;

  const avatarUrl  = user?.user_metadata?.avatar_url;
  const name       = user?.user_metadata?.full_name || user?.email;
  const email      = user?.email;
  const initials   = name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  /* ── Export to CSV ── */
  const exportCSV = () => {
    const headers = ['Name', 'Category', 'Unit', 'Current Qty', 'Min Qty', 'Vendor', 'Burn Rate/day', 'Note'];
    const rows = products.map(p => [
      `"${p.name.replace(/"/g, '""')}"`,
      p.cat,
      p.unit,
      p.currentQty,
      p.minQty,
      p.vendor,
      p.burnRate,
      `"${(p.note || '').replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `hirt-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ── Clear all ── */
  const handleClear = () => {
    if (window.confirm(`Delete all ${products.length} items from your inventory? This cannot be undone.`)) {
      onClearAll();
      onClose();
    }
  };

  return (
    <Modal title="Account" onClose={onClose} maxWidth={360}>
      {/* Profile */}
      <div className={styles.profile}>
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className={styles.avatar} referrerPolicy="no-referrer" />
        ) : (
          <div className={styles.avatarFallback}>{initials}</div>
        )}
        <div className={styles.profileInfo}>
          <div className={styles.profileName}>{name}</div>
          <div className={styles.profileEmail}>{email}</div>
        </div>
      </div>

      <div className={styles.divider} />

      {/* Data management */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Data</div>

        <button className={styles.actionRow} onClick={exportCSV}>
          <span className={styles.actionIcon}>↓</span>
          <div className={styles.actionInfo}>
            <div className={styles.actionLabel}>Export inventory</div>
            <div className={styles.actionSub}>{products.length} items → CSV file</div>
          </div>
        </button>

        <button className={`${styles.actionRow} ${styles.danger}`} onClick={handleClear}>
          <span className={styles.actionIcon}>✕</span>
          <div className={styles.actionInfo}>
            <div className={styles.actionLabel}>Clear all data</div>
            <div className={styles.actionSub}>Permanently delete all inventory items</div>
          </div>
        </button>
      </div>

      <div className={styles.divider} />

      {/* Sign out */}
      <button className={styles.signOutBtn} onClick={signOut}>
        Sign out
      </button>
    </Modal>
  );
}
