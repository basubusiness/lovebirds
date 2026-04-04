import { useState, useCallback } from 'react';

/**
 * useState backed by localStorage.
 * Drop-in replacement: swap the body for a Supabase fetch to go to production.
 */
export function useLocalStorage(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const set = useCallback(
    (next) => {
      setValue(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch (e) {
        console.warn('localStorage write failed:', e);
      }
    },
    [key]
  );

  return [value, set];
}
