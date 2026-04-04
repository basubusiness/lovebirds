import { useEffect } from 'react';
import styles from './Toast.module.css';

export default function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [onDone]);

  return <div className={styles.toast}>{message}</div>;
}
