import { useState } from 'react';
import Modal from './Modal';
import { VENDORS, CATEGORIES, UNITS } from '../constants';
import { uid } from '../utils';
import styles from './ProductModal.module.css';

const BLANK = {
  name: '', cat: 'Pantry', unit: 'pc',
  minQty: 1, currentQty: 0,
  vendor: 'cactus', burnRate: 0, note: '',
};

export default function ProductModal({ product, onSave, onClose, onDelete }) {
  const [form, setForm] = useState(
    product ? { ...product } : { ...BLANK, id: uid() }
  );

  const upd = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const numUpd = (key, step = 1) => (e) =>
    upd(key, parseFloat(parseFloat(e.target.value).toFixed(step < 1 ? 2 : 0)) || 0);

  const handleSave = () => {
    if (!form.name.trim()) return;
    onSave(form);
  };

  return (
    <Modal title={product ? 'Edit product' : 'Add product'} onClose={onClose}>
      <div className={styles.formRow}>
        <label>Product name</label>
        <input
          value={form.name}
          onChange={e => upd('name', e.target.value)}
          placeholder="e.g. Whole Milk"
          autoFocus
        />
      </div>

      <div className={styles.formGrid}>
        <div className={styles.formRow}>
          <label>Category</label>
          <select value={form.cat} onChange={e => upd('cat', e.target.value)}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className={styles.formRow}>
          <label>Unit</label>
          <select value={form.unit} onChange={e => upd('unit', e.target.value)}>
            {UNITS.map(u => <option key={u}>{u}</option>)}
          </select>
        </div>
      </div>

      <div className={styles.formGrid}>
        <div className={styles.formRow}>
          <label>Current quantity</label>
          <input type="number" step="0.5" min="0" value={form.currentQty} onChange={numUpd('currentQty', 0.5)} />
        </div>
        <div className={styles.formRow}>
          <label>Safety stock (min)</label>
          <input type="number" step="0.5" min="0" value={form.minQty} onChange={numUpd('minQty', 0.5)} />
        </div>
      </div>

      <div className={styles.formRow}>
        <label>Preferred vendor</label>
        <select value={form.vendor} onChange={e => upd('vendor', e.target.value)}>
          {VENDORS.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </div>

      <div className={styles.formRow}>
        <label>Avg consumption per day ({form.unit}/day)</label>
        <input type="number" step="0.1" min="0" value={form.burnRate} onChange={numUpd('burnRate', 0.1)} />
      </div>

      <div className={styles.formRow}>
        <label>Notes (optional)</label>
        <textarea
          rows={2}
          value={form.note}
          onChange={e => upd('note', e.target.value)}
          placeholder="e.g. Buy organic when possible"
          style={{ resize: 'vertical' }}
        />
      </div>

      <div className={styles.actions}>
        {product && (
          <button className={styles.deleteBtn} onClick={() => onDelete(product.id)}>
            Delete
          </button>
        )}
        <div className={styles.rightActions}>
          <button onClick={onClose}>Cancel</button>
          <button className={styles.saveBtn} onClick={handleSave}>Save product</button>
        </div>
      </div>
    </Modal>
  );
}
