import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type ThemeMode = 'light' | 'dark';

const ThemeContext = createContext<{ mode: ThemeMode; toggle: () => void }>({
  mode: 'light',
  toggle: () => {},
});

export const useThemeMode = () => useContext(ThemeContext);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem('ledger:theme');
    return stored === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    localStorage.setItem('ledger:theme', mode);
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  const toggle = () => setMode((m) => (m === 'light' ? 'dark' : 'light'));

  return (
    <ThemeContext.Provider value={{ mode, toggle }}>{children}</ThemeContext.Provider>
  );
}
