'use client';

import * as React from 'react';

/**
 * Keeps an editable local copy of a record and saves it shortly after the user stops typing.
 * Re-initialises only when `key` changes (e.g. a different record is opened).
 */
export function useAutosave<T>(key: string | undefined, initial: T | undefined, save: (v: T) => Promise<unknown> | void, delay = 400) {
  const [value, setValue] = React.useState<T | undefined>(initial);
  const dirty = React.useRef(false);
  const saveRef = React.useRef(save);
  saveRef.current = save;
  const latest = React.useRef(value);
  latest.current = value;
  const [lastKey, setLastKey] = React.useState(key);

  if (key !== lastKey || (value === undefined && initial !== undefined)) {
    setLastKey(key);
    setValue(initial);
    dirty.current = false;
  }

  React.useEffect(() => {
    if (!dirty.current || value === undefined) return;
    const t = setTimeout(() => {
      dirty.current = false;
      void saveRef.current(value);
    }, delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  const flush = React.useCallback(async () => {
    if (dirty.current && latest.current !== undefined) {
      dirty.current = false;
      await saveRef.current(latest.current);
    }
  }, []);

  React.useEffect(() => () => void flush(), [flush]);

  const update = React.useCallback((next: T | ((prev: T) => T)) => {
    dirty.current = true;
    setValue((prev) => (typeof next === 'function' ? (next as (p: T) => T)(prev as T) : next));
  }, []);

  return [value, update, flush] as const;
}

/** True on phones and tablets that can hand a file to the share sheet (Save to Files, WhatsApp, email). */
export function useCanShareFiles(): boolean {
  const [can, setCan] = React.useState(false);
  React.useEffect(() => {
    try {
      const probe = new File(['%PDF-'], 'probe.pdf', { type: 'application/pdf' });
      setCan(window.matchMedia('(pointer: coarse)').matches && !!navigator.canShare?.({ files: [probe] }));
    } catch {
      setCan(false);
    }
  }, []);
  return can;
}
