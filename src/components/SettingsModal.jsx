import { useState } from 'react';
import Modal from './Modal';
import styles from './SettingsModal.module.css';

export default function SettingsModal({ apiKey, onSave, onClose }) {
  const [key, setKey] = useState(apiKey || '');
  const [show, setShow] = useState(false);

  return (
    <Modal title="Settings" onClose={onClose} maxWidth={380}>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Gemini API Key</div>
        <div className={styles.sectionSub}>
          Stored only in your browser. Never sent anywhere except Google's API.
          Get a free key at <a href="https://aistudio.google.com" target="_blank" rel="noreferrer">aistudio.google.com</a>.
        </div>
        <div className={styles.keyRow}>
          <input
            type={show ? 'text' : 'password'}
            value={key}
            onChange={e => setKey(e.target.value)}
            placeholder="AIzaSy…"
            className={styles.keyInput}
          />
          <button className={styles.showBtn} onClick={() => setShow(s => !s)}>
            {show ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      <div className={styles.actions}>
        <button onClick={onClose}>Cancel</button>
        <button
          className={styles.saveBtn}
          onClick={() => { onSave(key.trim()); onClose(); }}
        >
          Save
        </button>
      </div>
    </Modal>
  );
}
