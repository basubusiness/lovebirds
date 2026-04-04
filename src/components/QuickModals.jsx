import { useState } from 'react';
import Modal from './Modal';
import styles from './QuickModal.module.css';

function QuickModal({ title, product, actionLabel, onSave, onClose, defaultQty }) {
  const [qty, setQty] = useState(defaultQty ?? 1);
  return (
    <Modal title={title} onClose={onClose} maxWidth={300}>
      <p className={styles.productName}>{product.name}</p>
      <div className={styles.formRow}>
        <label>Quantity ({product.unit})</label>
        <input
          type="number"
          step="0.5"
          min="0.5"
          value={qty}
          onChange={e => setQty(parseFloat(e.target.value) || 0)}
          autoFocus
        />
      </div>
      <div className={styles.actions}>
        <button onClick={onClose}>Cancel</button>
        <button className={styles.primaryBtn} onClick={() => qty > 0 && onSave(qty)}>
          {actionLabel}
        </button>
      </div>
    </Modal>
  );
}

export function ConsumeModal({ product, onSave, onClose }) {
  return (
    <QuickModal
      title="Log consumption"
      product={product}
      actionLabel="Log use"
      defaultQty={1}
      onSave={onSave}
      onClose={onClose}
    />
  );
}

export function RestockModal({ product, onSave, onClose }) {
  return (
    <QuickModal
      title="Restock"
      product={product}
      actionLabel="Add stock"
      defaultQty={product.minQty * 2}
      onSave={onSave}
      onClose={onClose}
    />
  );
}
