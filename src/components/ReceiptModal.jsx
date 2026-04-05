import { useState, useRef } from 'react';
import Modal from './Modal';
import { parseReceipt } from '../services/aiParser';
import { UNITS } from '../constants';
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

export default function ReceiptModal({ products, onConfirm, onClose }) {
  const [step,    setStep]    = useState(STEPS.upload);
  const [file,    setFile]    = useState(null);
  const [preview, setPreview] = useState(null);
  const [items,   setItems]   = useState([]);
  const [error,   setError]   = useState(null);
  const [warning, setWarning] = useState(null); // step2 degraded-mode banner
  const fileRef               = useRef();

  /* ── file selection ──────────────────────────────── */
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

  /* ── AI parse ────────────────────────────────────── */
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

      const enriched = parsed.map(item => {
        const match = item.matchedId
          ? products.find(p => p.id === item.matchedId)
          : null;
        return {
          ...item,
          matched:       match || null,
          selected:      true,
          editName:      item.nameCanonical || item.name,
          editNameOrig:  item.name,
          editNameEn:    item.nameEn || '',
          editQty:       item.quantity,
          editUnit:      item.unit,
        };
      });

      setItems(enriched);
      if (w) setWarning(w);
      setStep(STEPS.confirm);
    } catch (e) {
      setError(e.message);
      setStep(STEPS.upload);
    }
  };

  /* ── item editing ────────────────────────────────── */
  const updItem = (i, key, val) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [key]: val } : it));

  /* ── confirm → update inventory ──────────────────── */
  const handleConfirm = () => {
    const approved = items.filter(it => it.selected);
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
      maxWidth={500}
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
            <button
              className={styles.primaryBtn}
              onClick={runParse}
              disabled={!file}
            >
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
          {/* Degraded-mode warning banner */}
          {warning && (
            <div className={styles.warningBanner}>
              ⚠️ {warning}
            </div>
          )}

          <p className={styles.confirmIntro}>
            Tick the items to add to your inventory. Edit names and quantities if needed.
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
                  <div className={styles.itemTop}>
                    <input
                      className={styles.nameInput}
                      value={item.editName}
                      onChange={e => updItem(i, 'editName', e.target.value)}
                      disabled={!item.selected}
                    />
                    <ConfidencePip level={item.confidence} />
                  </div>
                  {item.editNameEn && item.editNameEn !== item.editName && (
                    <div className={styles.nameHint}>
                      {item.editNameOrig} · <em>{item.editNameEn}</em>
                    </div>
                  )}
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
                      <span className={styles.matchBadge}>↔ {item.matched.name}</span>
                    ) : (
                      <span className={styles.newBadge}>new item</span>
                    )}
                    <span className={styles.vendor}>{item.vendorGuess}</span>
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
