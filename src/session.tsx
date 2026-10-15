import { createContext, useContext, useEffect, useState, type Dispatch, type SetStateAction } from 'react';

export const SessionContext = createContext<string | undefined>(undefined);
/** Explicit, JSON-serializable host state. Use a unique key and validate restored data. */
export function useDemoSessionState<T>(key: string, initial: T, validate: (value: unknown) => value is T): [T, Dispatch<SetStateAction<T>>] {
  const namespace = useContext(SessionContext);
  const storageKey = namespace ? `demoable-react:v1:${encodeURIComponent(namespace)}:${encodeURIComponent(key)}` : undefined;
  const [state, setState] = useState(initial);
  const [loadedKey, setLoadedKey] = useState<string>();
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw !== null) { const value: unknown = JSON.parse(raw); if (validate(value)) setState(value); }
    } catch { /* Storage may be blocked or contain obsolete data. */ }
    setLoadedKey(storageKey);
    // Initial value and validator define this mounted field's schema.
  }, [storageKey]);
  useEffect(() => {
    if (!storageKey || loadedKey !== storageKey) return;
    try { sessionStorage.setItem(storageKey, JSON.stringify(state)); } catch { /* Keep working in memory. */ }
  }, [storageKey, loadedKey, state]);
  return [state, setState];
}

export const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';
export const isOpacity = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
