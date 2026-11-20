import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({ theme: 'dark', setTheme: () => {} });
export const useTheme = () => useContext(ThemeContext);

const isAndroid = () => typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

const readStoredTheme = () => {
  try {
    const stored = localStorage.getItem('dj_theme');
    return stored === 'light' || stored === 'dark' ? stored : null;
  } catch {
    return null;
  }
};

// Android WebViews report no meaningful light preference, so they always start dark.
const systemTheme = () => {
  if (isAndroid()) return 'dark';
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const initialTheme = () => readStoredTheme() || systemTheme();

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(initialTheme);
  const [followsSystem, setFollowsSystem] = useState(() => !readStoredTheme());

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    if (!followsSystem || typeof window === 'undefined' || !window.matchMedia) return undefined;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setThemeState(systemTheme());
    media.addEventListener?.('change', onChange);
    return () => media.removeEventListener?.('change', onChange);
  }, [followsSystem]);

  const setTheme = useCallback((next) => {
    const value = next === 'light' ? 'light' : 'dark';
    setFollowsSystem(false);
    setThemeState(value);
    try {
      localStorage.setItem('dj_theme', value);
    } catch {
      /* storage unavailable in some WebViews */
    }
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}