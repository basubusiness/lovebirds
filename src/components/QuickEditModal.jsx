/**
 * QuickEditModal.jsx
 *
 * Lightweight edit for the most-changed fields:
 *   - Product name (with auto-category suggestion as you type)
 *   - Product image (auto-fetched from Unsplash, replaceable by user upload)
 *   - Unit (tap-to-select pills)
 *   - Consumption frequency (qty + interval)
 *   - Safety stock (min qty)
 *
 * "More settings →" opens the full ProductModal.
 */

import { useState, useRef, useCallback } from 'react';
import Modal from './Modal';
import { UNITS } from '../constants';
import { supabase } from '../lib/supabase';
import styles from './QuickEditModal.module.css';

function toRate(qty, days) {
  if (!qty || !days || days <= 0) return 0;
  return parseFloat((qty / days).toFixed(4));
}

function rateToComponents(rate, currentQty, currentInterval) {
  if (currentQty && currentInterval) return { qty: currentQty, interval: currentInterval };
  if (!rate || rate <= 0) return { qty: 1, interval: 7 };
  const interval = Math.max(1, Math.round(1 / rate));
  return { qty: 1, interval };
}

// Token-overlap category suggestion (mirrors receipt import logic)
function suggestCategory(name, masterItems) {
  if (!name || !masterItems?.length) return null;
  const tokenize = (str) =>
    str.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length > 1);

  const qTokens = tokenize(name);
  let bestScore = 0;
  let bestItem  = null;

  for (const m of masterItems) {
    const mTokens = tokenize(m.name);
    const setQ = new Set(qTokens);
    const setM = new Set(mTokens);
    const inter = [...setQ].filter(t => setM.has(t)).length;
    const smaller = setQ.size <= setM.size ? setQ : setM;
    const larger  = setQ.size <= setM.size ? setM : setQ;
    const contained = [...smaller].every(t => larger.has(t));
    const score = contained ? 1 : inter / new Set([...setQ, ...setM]).size;
    if (score > bestScore) { bestScore = score; bestItem = m; }
  }
  return bestScore >= 0.35 ? bestItem : null;
}

export default function QuickEditModal({
  product, masterItems, learnedRate,
  onSave, onSaveImage, onFullEdit, onClose,
}) {
  const init = rateToComponents(product.burnRate, product.manualBurnQty, product.manualBurnIntervalDays);

  const [name,        setName]        = useState(product.name || '');
  const [unit,        setUnit]        = useState(product.unit || 'pc');
  const [burnQty,     setBurnQty]     = useState(init.qty);
  const [burnDays,    setBurnDays]    = useState(init.interval);
  const [minQty,      setMinQty]      = useState(product.minQty || 1);
  const [catSuggest,  setCatSuggest]  = useState(null);  // { id, name } suggested category
  const [imageUrl,    setImageUrl]    = useState(product._imageUrl ?? null);
  const [uploading,   setUploading]   = useState(false);
  const fileRef = useRef();
  const debounceRef = useRef();

  // Image already pre-loaded via _imageUrl prop from App

  // Debounced category suggestion as name changes
  const handleNameChange = useCallback((val) => {
    setName(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const suggestion = suggestCategory(val, masterItems);
      if (suggestion && suggestion.category_id) {
        setCatSuggest({ id: suggestion.category_id, masterName: suggestion.name });
      } else {
        setCatSuggest(null);
      }
    }, 400);
  }, [masterItems]);

  // User uploads their own photo
  const handleImageUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const ext  = file.name.split('.').pop();
      const path = `${product.id}-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('product-images')
        .upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(path);

      setImageUrl(publicUrl);
      // Save via App's setImageUrl (writes to products table)
      if (onSaveImage) onSaveImage(publicUrl);
    } catch (e) {
      console.error('[QuickEditModal] upload failed:', e);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    onSave({
      ...product,
      name,
      unit,
      minQty:                 parseFloat(minQty) || 1,
      burnRate:               toRate(burnQty, burnDays),
      manualBurnQty:          parseFloat(burnQty) || 1,
      manualBurnIntervalDays: parseInt(burnDays) || 7,
      ...(catSuggest?.accepted ? { categoryId: catSuggest.id } : {}),
    });
  };

  const computedRate = toRate(burnQty, burnDays);

  return (
    <Modal title="Edit item" onClose={onClose} maxWidth={380}>

      {/* Image header */}
      <div className={styles.imageSection}>
        {imageUrl ? (
          <div className={styles.imageWrap}>
            <img src={imageUrl} alt={name} className={styles.productImage} />
            <button
              className={styles.replacePhotoBtn}
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? 'Uploading…' : '📷 Replace photo'}
            </button>
          </div>
        ) : (
          <button
            className={styles.addPhotoBtn}
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Uploading…' : '📷 Add photo'}
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={e => handleImageUpload(e.target.files[0])}
        />
      </div>

      {/* Name */}
      <div className={styles.field}>
        <label className={styles.label}>Name</label>
        <input
          className={styles.nameInput}
          value={name}
          onChange={e => handleNameChange(e.target.value)}
          autoFocus
        />
        {catSuggest && !catSuggest.accepted && (
          <div className={styles.catSuggest}>
            Suggested category based on "{catSuggest.masterName}"
            <button
              className={styles.catSuggestBtn}
              onClick={() => setCatSuggest(s => ({ ...s, accepted: true }))}
            >Apply</button>
            <button
              className={styles.catSuggestDismiss}
              onClick={() => setCatSuggest(null)}
            >✕</button>
          </div>
        )}
        {catSuggest?.accepted && (
          <div className={styles.catAccepted}>✓ Category updated</div>
        )}
      </div>

      {/* Unit */}
      <div className={styles.field}>
        <label className={styles.label}>Unit</label>
        <div className={styles.unitPills}>
          {UNITS.map(u => (
            <button
              key={u}
              className={`${styles.unitPill} ${unit === u ? styles.unitPillActive : ''}`}
              onClick={() => setUnit(u)}
            >{u}</button>
          ))}
        </div>
      </div>

      {/* Consumption frequency */}
      <div className={styles.field}>
        <label className={styles.label}>I use this</label>
        <div className={styles.freqRow}>
          <input
            type="number"
            className={styles.numInput}
            min="0.1"
            step="0.5"
            value={burnQty}
            onChange={e => setBurnQty(parseFloat(e.target.value) || 1)}
          />
          <span className={styles.freqUnit}>{unit}</span>
          <span className={styles.freqEvery}>every</span>
          <input
            type="number"
            className={styles.numInput}
            min="1"
            step="1"
            value={burnDays}
            onChange={e => setBurnDays(parseInt(e.target.value) || 1)}
          />
          <span className={styles.freqUnit}>days</span>
        </div>
        <div className={styles.ratePreview}>
          = {computedRate.toFixed(3)} {unit}/day
          {learnedRate && learnedRate > 0 && (
            <button
              className={styles.useLearnedBtn}
              onClick={() => {
                const days = Math.max(1, Math.round(1 / learnedRate));
                setBurnQty(1);
                setBurnDays(days);
              }}
            >
              Use system rate (1 {unit} / {Math.max(1, Math.round(1 / learnedRate))}d)
            </button>
          )}
        </div>
      </div>

      {/* Safety stock */}
      <div className={styles.field}>
        <label className={styles.label}>Order when below</label>
        <div className={styles.freqRow}>
          <input
            type="number"
            className={styles.numInput}
            min="0"
            step="0.5"
            value={minQty}
            onChange={e => setMinQty(parseFloat(e.target.value) || 0)}
          />
          <span className={styles.freqUnit}>{unit}</span>
        </div>
      </div>

      <div className={styles.actions}>
        <button className={styles.fullEditBtn} onClick={onFullEdit}>
          More settings →
        </button>
        <div className={styles.rightActions}>
          <button onClick={onClose}>Cancel</button>
          <button className={styles.saveBtn} onClick={handleSave}>Save</button>
        </div>
      </div>
    </Modal>
  );
}
