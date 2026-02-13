import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

const STORAGE_THEME_KEY = 'rfid.theme.mode';
const DARK_THEME_NAME = 'techsovereign';
const LIGHT_THEME_NAME = 'light';

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function resolveInitialMode(): ThemeMode {
  const storedMode = window.localStorage.getItem(STORAGE_THEME_KEY);

  if (storedMode === 'light' || storedMode === 'dark') {
    return storedMode;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyMode(mode: ThemeMode): void {
  const htmlElement = document.documentElement;

  htmlElement.dataset.theme = mode === 'dark' ? DARK_THEME_NAME : LIGHT_THEME_NAME;
  htmlElement.classList.toggle('dark', mode === 'dark');
  htmlElement.style.colorScheme = mode;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('dark');

  useEffect(() => {
    const initialMode = resolveInitialMode();
    setModeState(initialMode);
    applyMode(initialMode);
  }, []);

  const setMode = (nextMode: ThemeMode) => {
    setModeState(nextMode);
    window.localStorage.setItem(STORAGE_THEME_KEY, nextMode);
    applyMode(nextMode);
  };

  const toggleMode = () => {
    setMode(mode === 'dark' ? 'light' : 'dark');
  };

  const value = useMemo(
    () => ({
      mode,
      isDark: mode === 'dark',
      setMode,
      toggleMode,
    }),
    [mode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeMode(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useThemeMode must be used within ThemeProvider.');
  }

  return context;
}
