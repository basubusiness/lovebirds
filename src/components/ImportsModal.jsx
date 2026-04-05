/**
 * ImportsModal.jsx
 *
 * Shows the full receipt import history.
 * Each row: vendor · purchase date · uploaded date · item count.
 * Expanding a row lets the user edit vendor/date or delete the import.
 *
 * Deleting an import does NOT reverse the inventory changes — it only
 * removes the history record. A warning makes this clear.
 */

import { useState } from 'react';
import Modal from './Modal';
import { VENDORS } from '../constants';
import styles from './ImportsModal.module.css';

function fmt(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function fmtUpload(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function vendorName(vendorId) {
  if (!vendorId) return 'Unknown store';
  const v = VENDORS.find(v => v.id === vendorId);
  return v ? v.name : vendorId;
}

export default function ImportsModal({ imports, loading, onDelete, onUpdate, onClose }) {
  const [expanded,    setExpanded]    = useState(null);   // id of open row
  const [editVendor,  setEditVendor]  = useState('');
  const [editDate,    setEditDate]    = useState('');
  const [saving,      setSaving]      = useState(false);
  const [confirmDel,  setConfirmDel]  = useState(null);   // id pending delete

  const openRow = (imp) => {
    if (expanded === imp.id) { setExpanded(null); return; }
    setExpanded(imp.id);
    setEditVendor(imp.vendor ?? '');
    setEditDate(imp.purchaseDate ?? '');
  };

  const handleSave = async (id) => {
    setSaving(true);
    const imp = imports.find(r => r.id === id);
    await onUpdate(id, {
      vendor:       editVendor,
      purchaseDate: editDate,
      items:        imp.items,
    });
    setSaving(false);
    setExpanded(null);
  };

  const handleDelete = async (id) => {
    await onDelete(id);
    setConfirmDel(null);
    setExpanded(null);
  };

  return (
    <Modal title="Import history" onClose={onClose} maxWidth={560}>
      {loading && (
        <div className={styles.empty}>Loading…</div>
      )}

      {!loading && imports.length === 0 && (
        <div className={styles.empty}>
          No imports yet. Upload a receipt to get started.
        </div>
      )}

      {!loading && imports.length > 0 && (
        <div className={styles.list}>
          {imports.map(imp => (
            <div key={imp.id} className={styles.card}>
              {/* ── Summary row ── */}
              <button
                className={styles.summaryRow}
                onClick={() => openRow(imp)}
              >
                <span className={styles.vendor}>{vendorName(imp.vendor)}</span>
                <span className={styles.meta}>
                  <span className={styles.metaItem}>
                    🛒 {fmt(imp.purchaseDate)}
                  </span>
                  <span className={styles.metaItem}>
                    ↑ {fmtUpload(imp.uploadedAt)}
                  </span>
                  <span className={styles.badge}>
                    {imp.items.length} item{imp.items.length !== 1 ? 's' : ''}
                  </span>
                </span>
                <span className={styles.chevron}>
                  {expanded === imp.id ? '▲' : '▼'}
                </span>
              </button>

              {/* ── Expanded detail ── */}
              {expanded === imp.id && (
                <div className={styles.detail}>
                  {/* Item list (read-only snapshot) */}
                  <div className={styles.itemList}>
                    {imp.items.map((it, i) => (
                      <div key={i} className={styles.itemRow}>
                        <span className={styles.itemName}>
                          {it.name}
                          {it.is_new && <span className={styles.newTag}>new</span>}
                        </span>
                        <span className={styles.itemQty}>{it.qty} {it.unit}</span>
                      </div>
                    ))}
                  </div>

                  {/* Edit fields */}
                  <div className={styles.editFields}>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Store</label>
                      <select
                        className={styles.fieldSelect}
                        value={editVendor}
                        onChange={e => setEditVendor(e.target.value)}
                      >
                        <option value="">Unknown</option>
                        {VENDORS.map(v => (
                          <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Purchase date</label>
                      <input
                        type="date"
                        className={styles.fieldDate}
                        value={editDate}
                        onChange={e => setEditDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className={styles.actions}>
                    {confirmDel === imp.id ? (
                      <div className={styles.confirmDelete}>
                        <span className={styles.confirmText}>
                          ⚠️ This only removes the history record — inventory quantities won't change.
                        </span>
                        <button
                          className={styles.dangerBtn}
                          onClick={() => handleDelete(imp.id)}
                        >
                          Yes, delete
                        </button>
                        <button onClick={() => setConfirmDel(null)}>Cancel</button>
                      </div>
                    ) : (
                      <>
                        <button
                          className={styles.deleteBtn}
                          onClick={() => setConfirmDel(imp.id)}
                        >
                          Delete record
                        </button>
                        <button
                          className={styles.saveBtn}
                          onClick={() => handleSave(imp.id)}
                          disabled={saving}
                        >
                          {saving ? 'Saving…' : 'Save changes'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
