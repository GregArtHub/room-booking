import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { usePreferences } from '../theme/PreferencesContext';
import { NotificationBell } from './NotificationBell';
import { Button } from './ui';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-indigo-600 text-white' : 'hover:bg-slate-200 dark:hover:bg-slate-700'}`;

export function Layout() {
  const { t } = useTranslation();
  const { user, isAdmin, logout } = useAuth();
  const { theme, setTheme, locale, setLocale } = usePreferences();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const close = () => setMenuOpen(false);
  const nextTheme = theme === 'dark' ? 'light' : 'dark';

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-3 py-2">
          <Link
            to="/rooms"
            className="text-lg font-bold text-indigo-600 dark:text-indigo-400"
            onClick={close}
          >
            RoomBook
          </Link>

          <div className="flex items-center gap-1 md:order-last">
            {user && <NotificationBell />}
            <button
              type="button"
              aria-label={t('nav.theme')}
              onClick={() => setTheme(nextTheme)}
              className="rounded-md p-2 hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              <span aria-hidden="true">{theme === 'dark' ? '☀️' : '🌙'}</span>
            </button>
            <button
              type="button"
              aria-label={t('nav.language')}
              onClick={() => setLocale(locale === 'ru' ? 'en' : 'ru')}
              className="rounded-md px-2 py-2 text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              {locale === 'ru' ? 'EN' : 'RU'}
            </button>
            <button
              type="button"
              aria-label={t('nav.menu')}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              className="rounded-md p-2 hover:bg-slate-200 dark:hover:bg-slate-700 md:hidden"
            >
              <span aria-hidden="true">☰</span>
            </button>
          </div>

          <nav
            className={`${menuOpen ? 'flex' : 'hidden'} w-full flex-col gap-1 md:flex md:w-auto md:flex-1 md:flex-row md:items-center md:justify-center`}
          >
            <NavLink to="/rooms" className={linkClass} onClick={close}>
              {t('nav.rooms')}
            </NavLink>
            {user && (
              <>
                <NavLink to="/my-bookings" className={linkClass} onClick={close}>
                  {t('nav.myBookings')}
                </NavLink>
                <NavLink to="/profile" className={linkClass} onClick={close}>
                  {t('nav.profile')}
                </NavLink>
              </>
            )}
            {isAdmin && (
              <>
                <NavLink to="/admin/rooms" className={linkClass} onClick={close}>
                  {t('nav.adminRooms')}
                </NavLink>
                <NavLink to="/admin/users" className={linkClass} onClick={close}>
                  {t('nav.adminUsers')}
                </NavLink>
                <NavLink to="/admin/dashboard" className={linkClass} onClick={close}>
                  {t('nav.dashboard')}
                </NavLink>
              </>
            )}
            {user ? (
              <Button
                variant="secondary"
                onClick={async () => {
                  close();
                  await logout();
                  navigate('/login');
                }}
              >
                {t('nav.logout')}
              </Button>
            ) : (
              <>
                <NavLink to="/login" className={linkClass} onClick={close}>
                  {t('nav.login')}
                </NavLink>
                <NavLink to="/register" className={linkClass} onClick={close}>
                  {t('nav.register')}
                </NavLink>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-3 py-6">
        <Outlet />
      </main>
    </div>
  );
}
