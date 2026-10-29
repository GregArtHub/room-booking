import { useQuery } from '@tanstack/react-query';
import { ChangeEvent, FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { api, errorMessage, fieldErrors } from '../api/client';
import type { Booking, Paginated, Theme, User } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../components/Toast';
import { Badge, Button, Card, Input, Select } from '../components/ui';
import { formatRange } from '../lib/time';
import { usePreferences } from '../theme/PreferencesContext';

const MAX_AVATAR_MB = 2;

export default function ProfilePage() {
  const { t, i18n } = useTranslation();
  const { user, setUser } = useAuth();
  const { theme, setTheme, locale, setLocale } = usePreferences();
  const toast = useToast();

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [nameError, setNameError] = useState('');
  const [savingName, setSavingName] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passErrors, setPassErrors] = useState<Record<string, string>>({});
  const [savingPass, setSavingPass] = useState(false);
  const [avatarError, setAvatarError] = useState('');

  const history = useQuery({
    queryKey: ['my-bookings', 'recent'],
    queryFn: () => api.get<Paginated<Booking>>('/bookings/my', { limit: 5, sort: '-createdAt' }),
  });

  if (!user) return null;

  async function saveName(e: FormEvent) {
    e.preventDefault();
    if (fullName.trim().length < 2) {
      setNameError(t('auth.nameMin'));
      return;
    }
    setNameError('');
    setSavingName(true);
    try {
      const res = await api.patch<{ data: User }>('/users/me', { fullName: fullName.trim() });
      setUser(res.data);
      toast.push(t('common.saved'));
    } catch (err) {
      setNameError(errorMessage(err, t('common.somethingWrong')));
    } finally {
      setSavingName(false);
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!currentPassword) next.currentPassword = t('common.required');
    if (newPassword.length < 8) next.newPassword = t('auth.passwordMin');
    setPassErrors(next);
    if (Object.keys(next).length > 0) return;

    setSavingPass(true);
    try {
      await api.post('/users/me/password', { currentPassword, newPassword });
      toast.push(t('profile.passwordChanged'));
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setPassErrors({
        ...fieldErrors(err),
        currentPassword: errorMessage(err, t('common.somethingWrong')),
      });
    } finally {
      setSavingPass(false);
    }
  }

  async function uploadAvatar(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type))
      return setAvatarError(t('profile.fileTypeError'));
    if (file.size > MAX_AVATAR_MB * 1024 * 1024)
      return setAvatarError(t('profile.fileSizeError', { mb: MAX_AVATAR_MB }));
    setAvatarError('');
    try {
      const res = await api.upload<{ data: { avatarUrl: string } }>('/users/me/avatar', file);
      setUser({ ...user!, avatarUrl: res.data.avatarUrl });
      toast.push(t('profile.avatarSaved'));
    } catch (err) {
      setAvatarError(errorMessage(err, t('common.somethingWrong')));
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('profile.title')}</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-lg font-semibold">{t('profile.personal')}</h2>
          <div className="mb-4 flex items-center gap-4">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.fullName}
                className="h-20 w-20 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-600 text-2xl font-bold text-white">
                {user.fullName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <label className="inline-block cursor-pointer rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700">
                {t('profile.upload')}
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  className="sr-only"
                  onChange={uploadAvatar}
                />
              </label>
              <p className="mt-1 text-xs text-slate-500">{t('profile.avatarHint')}</p>
              {avatarError && (
                <p role="alert" className="text-sm text-red-600">
                  {avatarError}
                </p>
              )}
            </div>
          </div>
          <form onSubmit={saveName} noValidate className="space-y-3">
            <Input
              label={t('auth.fullName')}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              error={nameError}
            />
            <Input label={t('auth.email')} value={user.email} disabled readOnly />
            <p className="text-sm">
              {t('profile.role')}:{' '}
              {user.roles.map((r) => (
                <Badge key={r} tone="indigo">
                  {t(`adminUsers.${r}`)}
                </Badge>
              ))}
            </p>
            <Button type="submit" loading={savingName}>
              {t('common.save')}
            </Button>
          </form>
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-4 text-lg font-semibold">{t('profile.appearance')}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                label={t('profile.language')}
                value={locale}
                onChange={(e) => setLocale(e.target.value as 'ru' | 'en')}
              >
                <option value="ru">Русский</option>
                <option value="en">English</option>
              </Select>
              <Select
                label={t('profile.theme')}
                value={theme}
                onChange={(e) => setTheme(e.target.value as Theme)}
              >
                <option value="light">{t('profile.light')}</option>
                <option value="dark">{t('profile.dark')}</option>
                <option value="system">{t('profile.system')}</option>
              </Select>
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 text-lg font-semibold">{t('profile.security')}</h2>
            <form onSubmit={changePassword} noValidate className="space-y-3">
              <Input
                label={t('profile.currentPassword')}
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                error={passErrors.currentPassword}
              />
              <Input
                label={t('auth.newPassword')}
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                error={passErrors.newPassword}
              />
              <Button type="submit" loading={savingPass}>
                {t('profile.changePassword')}
              </Button>
            </form>
          </Card>
        </div>
      </div>

      <Card>
        <h2 className="mb-3 text-lg font-semibold">{t('profile.history')}</h2>
        {history.data && history.data.data.length > 0 ? (
          <ul className="divide-y divide-slate-200 dark:divide-slate-700">
            {history.data.data.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
              >
                <span>
                  <strong>{b.title}</strong> · {b.room.name} ·{' '}
                  {formatRange(b.startsAt, b.endsAt, i18n.language)}
                </span>
                <Badge tone={b.status === 'ACTIVE' ? 'green' : 'red'}>
                  {b.status === 'ACTIVE' ? t('my.active') : t('my.cancelledStatus')}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">{t('profile.historyEmpty')}</p>
        )}
        <Link to="/my-bookings" className="mt-3 inline-block text-sm text-indigo-600 underline">
          {t('nav.myBookings')}
        </Link>
      </Card>
    </div>
  );
}
