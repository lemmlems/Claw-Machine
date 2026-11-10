import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';

type Theme = 'light' | 'dark';
type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
};

const storageKey = 'tons-claw-theme';
const ThemeContext = createContext<ThemeContextValue | null>(null);

function readTheme(): Theme {
  try {
    return localStorage.getItem(storageKey) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try {
      localStorage.setItem(storageKey, theme);
    } catch {
      // Theme still applies for this session when storage is unavailable.
    }
  }, [theme]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === storageKey && (event.newValue === 'light' || event.newValue === 'dark')) {
        setTheme(event.newValue);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const value = useMemo(() => ({
    theme,
    toggleTheme: () => setTheme((current) => current === 'light' ? 'dark' : 'light'),
  }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function ThemeToggle() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('ThemeToggle must be used within ThemeProvider.');

  const dark = context.theme === 'dark';
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={context.toggleTheme}
      aria-label={`Switch to ${dark ? 'light' : 'dark'} theme`}
      title={`Switch to ${dark ? 'light' : 'dark'} theme`}
    >
      {dark ? '☀ Light' : '☾ Dark'}
    </button>
  );
}
