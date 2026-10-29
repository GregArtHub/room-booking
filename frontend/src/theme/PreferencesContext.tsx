import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import type { Locale, Theme } from '../api/types';
import { useAuth } from '../auth/AuthContext';

interface PreferencesValue {
  theme: Theme;
  locale: Locale;
  setTheme: (theme: Theme) => void;
  setLocale: (locale: Locale) => void;
}

const PreferencesContext = createContext<PreferencesValue | null>(null);

function applyTheme(theme: Theme) {
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  const dark = theme === 'dark' || (theme === 'system' && prefersDark);
  document.documentElement.classList.toggle('dark', dark);
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { user, setUser } = useAuth();
  const { i18n } = useTranslation();
  const [theme, setThemeState] = useState<Theme>(
    () => (localStorage.getItem('theme') as Theme) ?? 'system',
  );
  const locale: Locale = i18n.language?.startsWith('en') ? 'en' : 'ru';

  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return;
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    media?.addEventListener('change', onChange);
    return () => media?.removeEventListener('change', onChange);
  }, [theme]);

  // после входа применяем сохранённые в профиле тему и язык
  useEffect(() => {
    if (!user) return;
    setThemeState(user.theme);
    localStorage.setItem('theme', user.theme);
    localStorage.setItem('locale', user.locale);
    i18n.changeLanguage(user.locale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const persist = useCallback(
    (patch: { theme?: Theme; locale?: Locale }) => {
      if (!user) return;
      api
        .patch<{ data: typeof user }>('/users/me', patch)
        .then((res) => setUser(res.data))
        .catch(() => undefined);
    },
    [user, setUser],
  );

  const setTheme = useCallback(
    (next: Theme) => {
      setThemeState(next);
      localStorage.setItem('theme', next);
      persist({ theme: next });
    },
    [persist],
  );

  const setLocale = useCallback(
    (next: Locale) => {
      i18n.changeLanguage(next);
      localStorage.setItem('locale', next);
      persist({ locale: next });
    },
    [i18n, persist],
  );

  const value = useMemo(
    () => ({ theme, locale, setTheme, setLocale }),
    [theme, locale, setTheme, setLocale],
  );
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used inside PreferencesProvider');
  return ctx;
}
