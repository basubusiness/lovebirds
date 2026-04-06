import { useState, useRef } from 'react';
import Modal from './Modal';
import { parseReceipt } from '../services/aiParser';
import { UNITS, VENDORS } from '../constants';
import { enrichWithMatches } from '../utils/matcher';
import { useCategories } from '../hooks/useCategories';
import styles from './ReceiptModal.module.css';

const STEPS = { upload: 'upload', parsing: 'parsing', confirm: 'confirm' };

function ConfidencePip({ level }) {
  const colors = { high: '#1D9E75', medium: '#EF9F27', low: '#E24B4A' };
  return (
    <span
      className={styles.pip}
      style={{ background: colors[level] || '#888' }}
      title={`Confidence: ${level}`}
    />
  );
}

// ── Inline category picker per row ────────────────────────────

function CategoryPicker({ value, onChange, flatList }) {
  const subcats = flatList.filter(c => c.parent_id !== null);
  return (
    <select
      className={styles.catSelect}
      value={value ?? ''}
      onChange={e => onChange(e.target.value ? parseInt(e.target.value) : null)}
    >
      <option value="">Uncategorized</option>
      {subcats.map(c => (
        <option key={c.id} value={c.id}>{c.label}</option>
      ))}
    </select>
  );
}

export default function ReceiptModal({ products, masterItems, onConfirm, onClose }) {
  const [step,        setStep]       = useState(STEPS.upload);
  const [file,        setFile]       = useState(null);
  const [preview,     setPreview]    = useState(null);
  const [items,       setItems]      = useState([]);
  const [error,       setError]      = useState(null);
  const [warning,     setWarning]    = useState(null);
  const [batchVendor, setBatchVendor] = useState('');
  const [batchDate,   setBatchDate]  = useState(new Date().toISOString().slice(0, 10));
  const fileRef = useRef();
  const { flatList } = useCategories();

  // ── Suggest category for a receipt item ──────────────────────
  // 1. Check master items by name match
  // 2. Check existing inventory match (item.matched)
  // 3. Fall back to null
  const suggestCategory = (item) => {
    if (item.matched?.categoryId) return item.matched.categoryId;
    const q = (item.nameCanonical || item.name || '').toLowerCase();
    const master = masterItems.find(m =>
      m.name.toLowerCase().includes(q) || q.includes(m.name.toLowerCase())
    );
    return master?.category_id ?? null;
  };

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
    setError(null);
    setWarning(null);
    if (f.type.startsWith('image/')) {
      setPreview(URL.createObjectURL(f));
    } else {
      setPreview(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const runParse = async () => {
    if (!file) return;
    setStep(STEPS.parsing);
    setError(null);
    setWarning(null);
    try {
      const { items: parsed, warning: w } = await parseReceipt(file, products);
      if (!parsed || parsed.length === 0) {
        setError('No items found. Try a clearer photo or different receipt.');
        setStep(STEPS.upload);
        return;
      }

      const matched = enrichWithMatches(parsed, products);
      const enriched = matched.map(item => ({
        ...item,
        selected:     true,
        // Priority: nameEn = guaranteed English translation from Gemini
        // nameCanonical can still be French, name is always the original
        editName:     item.nameEn || item.nameCanonical || item.name,
        editNameOrig: item.name,
        editNameEn:   item.nameEn || '',
        editQty:      item.quantity,
        editUnit:     item.unit,
        editCategoryId: suggestCategory(item),
        isNew:        !item.matched,
      }));

      if (!batchVendor && parsed[0]?.vendorGuess) {
        const guessed = VENDORS.find(v =>
          v.name.toLowerCase().includes(parsed[0].vendorGuess.toLowerCase()) ||
          parsed[0].vendorGuess.toLowerCase().includes(v.name.toLowerCase())
        );
        if (guessed) setBatchVendor(guessed.id);
      }

      setItems(enriched);
      if (w) setWarning(w);
      setStep(STEPS.confirm);
    } catch (e) {
      setError(e.message);
      setStep(STEPS.upload);
    }
  };

  const updItem = (i, key, val) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [key]: val } : it));

  const handleConfirm = () => {
    const approved = items.filter(it => it.selected).map(it => ({
      ...it,
      batchVendor,
      batchDate,
    }));
    onConfirm(approved);
  };

  const selectedCount = items.filter(i => i.selected).length;

  return (
    <Modal
      title={
        step === STEPS.upload  ? 'Import receipt' :
        step === STEPS.parsing ? 'Reading receipt…' :
        `Review items (${selectedCount} of ${items.length} selected)`
      }
      onClose={onClose}
      maxWidth={520}
    >
      {/* ── UPLOAD STEP ── */}
      {step === STEPS.upload && (
        <div>
          <div
            className={styles.dropZone}
            onClick={() => fileRef.current.click()}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
          >
            {preview ? (
              <img src={preview} alt="receipt preview" className={styles.preview} />
            ) : file ? (
              <div className={styles.fileInfo}>
                <div className={styles.fileIcon}>PDF</div>
                <div className={styles.fileName}>{file.name}</div>
              </div>
            ) : (
              <div className={styles.dropHint}>
                <div className={styles.dropIcon}>↑</div>
                <div className={styles.dropText}>Drop a receipt here or click to browse</div>
                <div className={styles.dropSub}>JPG, PNG, WEBP, PDF</div>
              </div>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            style={{ display: 'none' }}
            onChange={e => handleFile(e.target.files[0])}
          />

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.actions}>
            <button onClick={onClose}>Cancel</button>
            <button className={styles.primaryBtn} onClick={runParse} disabled={!file}>
              Analyse with AI →
            </button>
          </div>
        </div>
      )}

      {/* ── PARSING STEP ── */}
      {step === STEPS.parsing && (
        <div className={styles.parsingState}>
          <div className={styles.spinner} />
          <div className={styles.parsingText}>Gemini is reading your receipt…</div>
          <div className={styles.parsingSub}>Usually takes 5–15 seconds</div>
        </div>
      )}

      {/* ── CONFIRM STEP ── */}
      {step === STEPS.confirm && (
        <div>
          {warning && <div className={styles.warningBanner}>⚠️ {warning}</div>}

          {/* Batch vendor + date */}
          <div className={styles.batchFields}>
            <div className={styles.batchField}>
              <label className={styles.batchLabel}>Store</label>
              <select
                className={styles.batchSelect}
                value={batchVendor}
                onChange={e => setBatchVendor(e.target.value)}
              >
                <option value="">Unknown</option>
                {VENDORS.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
            <div className={styles.batchField}>
              <label className={styles.batchLabel}>Purchase date</label>
              <input
                type="date"
                className={styles.batchDate}
                value={batchDate}
                onChange={e => setBatchDate(e.target.value)}
              />
            </div>
          </div>

          <p className={styles.confirmIntro}>
            Review what the AI found. Adjust names, quantities, and categories before importing.
          </p>

          <div className={styles.itemList}>
            {items.map((item, i) => (
              <div
                key={i}
                className={`${styles.itemRow} ${!item.selected ? styles.itemDeselected : ''}`}
              >
                <input
                  type="checkbox"
                  checked={item.selected}
                  onChange={e => updItem(i, 'selected', e.target.checked)}
                  className={styles.checkbox}
                />
                <div className={styles.itemBody}>
                  {/* Row 1: name + confidence */}
                  <div className={styles.itemTop}>
                    <input
                      className={styles.nameInput}
                      value={item.editName}
                      onChange={e => updItem(i, 'editName', e.target.value)}
                      disabled={!item.selected}
                    />
                    <ConfidencePip level={item.confidence} />
                  </div>

                  {/* Row 2: original name hint */}
                  {item.editNameOrig && item.editNameOrig !== item.editName && (
                    <div className={styles.nameHint}>
                      orig: <em>{item.editNameOrig}</em>
                    </div>
                  )}

                  {/* Row 3: qty + unit + match badge */}
                  <div className={styles.itemBottom}>
                    <input
                      type="number"
                      className={styles.qtyInput}
                      value={item.editQty}
                      min="0"
                      step="0.5"
                      onChange={e => updItem(i, 'editQty', parseFloat(e.target.value) || 0)}
                      disabled={!item.selected}
                    />
                    <select
                      className={styles.unitSelect}
                      value={item.editUnit}
                      onChange={e => updItem(i, 'editUnit', e.target.value)}
                      disabled={!item.selected}
                    >
                      {UNITS.map(u => <option key={u}>{u}</option>)}
                    </select>
                    {item.matched ? (
                      <span className={styles.matchBadge}>
                        ↔ {item.matched.name}
                        {item.matchScore < 1 && (
                          <span className={styles.matchScore}> {Math.round(item.matchScore * 100)}%</span>
                        )}
                      </span>
                    ) : (
                      <span className={styles.newBadge}>new item</span>
                    )}
                  </div>

                  {/* Row 4: category picker */}
                  <div className={styles.itemCat}>
                    <span className={styles.catLabel}>Category</span>
                    <CategoryPicker
                      value={item.editCategoryId}
                      onChange={val => updItem(i, 'editCategoryId', val)}
                      flatList={flatList}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.actions}>
            <button onClick={() => setStep(STEPS.upload)}>← Re-upload</button>
            <button
              className={styles.primaryBtn}
              onClick={handleConfirm}
              disabled={selectedCount === 0}
            >
              Add {selectedCount} item{selectedCount !== 1 ? 's' : ''} to inventory
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
