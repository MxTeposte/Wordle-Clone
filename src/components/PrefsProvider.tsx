'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_PREFS, keys, type Prefs, readJSON, writeJSON } from '@/lib/storage';

type PrefsContextValue = {
  prefs: Prefs;
  loaded: boolean;
  setPrefs: (patch: Partial<Prefs>) => void;
};

const PrefsContext = createContext<PrefsContextValue | null>(null);

export function PrefsProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setState] = useState<Prefs>(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Lectura única de localStorage tras montar (no disponible durante el render estático).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ ...DEFAULT_PREFS, ...readJSON<Partial<Prefs>>(keys.prefs) });
    setLoaded(true);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const theme = prefs.theme === 'system' ? (media.matches ? 'dark' : 'light') : prefs.theme;
      root.setAttribute('data-theme', theme);
      if (prefs.highContrast) root.setAttribute('data-contrast', 'high');
      else root.removeAttribute('data-contrast');
    };
    if (loaded) apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [prefs, loaded]);

  const setPrefs = useCallback((patch: Partial<Prefs>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      writeJSON(keys.prefs, next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ prefs, loaded, setPrefs }), [prefs, loaded, setPrefs]);
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): PrefsContextValue {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error('usePrefs debe usarse dentro de PrefsProvider');
  return ctx;
}
