/**
 * SettingsModal.jsx
 *
 * Per-vendor schedule configuration.
 * Fixed schedule: pick a day of week.
 * Flexible schedule: pick an interval in days.
 * Both: optionally override next order date.
 */

import { useState, useEffect } from 'react';
import Modal from './Modal';
import { VENDORS } from '../constants';
import styles from './SettingsModal.module.css';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function VendorScheduleRow({ vendor, schedule, onSave }) {
  const [type,     setType]     = useState(schedule?.schedule_type ?? 'flexible');
  const [dow,      setDow]      = useState(schedule?.day_of_week ?? 6); // Saturday default
  const [interval, setInterval] = useState(schedule?.interval_days ?? 7);
  const [nextDate, setNextDate] = useState(schedule?.next_order_date ?? '');
  const [dirty,    setDirty]    = useState(false);
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    setType(schedule?.schedule_type ?? 'flexible');
    setDow(schedule?.day_of_week ?? 6);
    setInterval(schedule?.interval_days ?? 7);
    setNextDate(schedule?.next_order_date ?? '');
    setDirty(false);
  }, [schedule]);

  const mark = (fn) => (...args) => { fn(...args); setDirty(true); };

  const handleSave = async () => {
    setSaving(true);
    await onSave(vendor.id, {
      scheduleType:  type,
      dayOfWeek:     type === 'fixed'    ? parseInt(dow)      : null,
      intervalDays:  type === 'flexible' ? parseInt(interval) : null,
      nextOrderDate: nextDate || null,
    });
    setSaving(false);
    setDirty(false);
  };

  return (
    <div className={styles.vendorRow}>
      <div className={styles.vendorHeader}>
        <span className={styles.vendorDot} style={{ background: vendor.color }} />
        <span className={styles.vendorName}>{vendor.name}</span>
      </div>

      <div className={styles.scheduleFields}>
        <div className={styles.typeToggle}>
          <button
            className={`${styles.typeBtn} ${type === 'fixed' ? styles.typeBtnActive : ''}`}
            onClick={mark(() => setType('fixed'))}
          >Fixed day</button>
          <button
            className={`${styles.typeBtn} ${type === 'flexible' ? styles.typeBtnActive : ''}`}
            onClick={mark(() => setType('flexible'))}
          >Every N days</button>
        </div>

        {type === 'fixed' ? (
          <select
            className={styles.fieldInput}
            value={dow}
            onChange={mark(e => setDow(e.target.value))}
          >
            {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
        ) : (
          <div className={styles.intervalRow}>
            <span className={styles.intervalLabel}>Every</span>
            <input
              type="number"
              className={styles.intervalInput}
              min="1"
              max="60"
              value={interval}
              onChange={mark(e => setInterval(e.target.value))}
            />
            <span className={styles.intervalLabel}>days</span>
          </div>
        )}

        <div className={styles.overrideRow}>
          <label className={styles.overrideLabel}>Override next order date</label>
          <input
            type="date"
            className={styles.fieldInput}
            value={nextDate}
            onChange={mark(e => setNextDate(e.target.value))}
          />
        </div>

        {dirty && (
          <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function SettingsModal({ schedules, onSave, onClose }) {
  const getSchedule = (vendorId) =>
    schedules.find(s => s.vendor_id === vendorId) ?? null;

  return (
    <Modal title="Store schedules" onClose={onClose} maxWidth={480}>
      <p className={styles.intro}>
        Set how often you shop at each store. The dashboard will show what to order before your next visit.
      </p>
      <div className={styles.list}>
        {VENDORS.map(v => (
          <VendorScheduleRow
            key={v.id}
            vendor={v}
            schedule={getSchedule(v.id)}
            onSave={onSave}
          />
        ))}
      </div>
    </Modal>
  );
}
