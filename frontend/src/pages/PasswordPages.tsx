import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import { Button, Card, Input } from '../components/ui';
import { isEmail } from '../lib/validation';

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isEmail(email)) {
      setError(t('auth.invalidEmail'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim().toLowerCase() });
      setSent(true);
    } catch (err) {
      setError(errorMessage(err, t('common.somethingWrong')));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mx-auto max-w-md">
      <h1 className="mb-2 text-2xl font-bold">{t('auth.forgotTitle')}</h1>
      <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">{t('auth.forgotHint')}</p>
      {sent ? (
        <p
          role="status"
          className="rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-200"
        >
          {t('auth.forgotSent')}
        </p>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <Input
            label={t('auth.email')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={error}
          />
          <Button type="submit" loading={loading} className="w-full">
            {t('auth.sendLink')}
          </Button>
        </form>
      )}
      <Link to="/login" className="mt-4 inline-block text-sm text-indigo-600 underline">
        {t('auth.backToLogin')}
      </Link>
    </Card>
  );
}

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get('token');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError(t('auth.passwordMin'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword: password });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err, t('common.somethingWrong')));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mx-auto max-w-md">
      <h1 className="mb-4 text-2xl font-bold">{t('auth.resetTitle')}</h1>
      {!token ? (
        <p role="alert" className="text-sm text-red-600">
          {t('auth.resetNoToken')}
        </p>
      ) : done ? (
        <p
          role="status"
          className="rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-200"
        >
          {t('auth.resetDone')}
        </p>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <Input
            label={t('auth.newPassword')}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={error}
          />
          <Button type="submit" loading={loading} className="w-full">
            {t('common.save')}
          </Button>
        </form>
      )}
      <Link to="/login" className="mt-4 inline-block text-sm text-indigo-600 underline">
        {t('auth.backToLogin')}
      </Link>
    </Card>
  );
}
