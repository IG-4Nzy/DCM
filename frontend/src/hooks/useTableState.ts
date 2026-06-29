// @ts-nocheck
import { useState, useEffect } from 'react';

export function useTableState<T>(key: string, initialValue: T) {
  let adjustedInitialValue = initialValue;
  if (key.endsWith('_rowsPerPage')) {
    adjustedInitialValue = 25 as unknown as T;
  }

  const [state, setState] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        const parsed = JSON.parse(item);
        if (key.endsWith('_rowsPerPage')) {
          const val = Number(parsed);
          if (val === 25 || val === 50 || val === 100) {
            return parsed;
          }
          return 25 as unknown as T;
        }
        return parsed;
      }
      return adjustedInitialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return adjustedInitialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, state]);

  return [state, setState] as const;
}
