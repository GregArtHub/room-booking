import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Button, Card, Input } from '../components/ui';
import { isEmail } from '../lib/validation';

export default function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!isEmail(email)) next.email = t('auth.invalidEmail');
    if (!password) next.password = t('common.required');
    setErrors(next);
    setFormError('');
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      navigate((location.state as { from?: string } | null)?.from ?? '/rooms', { replace: true });
    } catch (err) {
      setFormError(errorMessage(err, t('auth.loginFailed')));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mx-auto max-w-md">
      <h1 className="mb-4 text-2xl font-bold">{t('auth.loginTitle')}</h1>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Input
          label={t('auth.email')}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />
        <Input
          label={t('auth.password')}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />
        {formError && (
          <p role="alert" className="text-sm text-red-600">
            {formError}
          </p>
        )}
        <Button type="submit" loading={loading} className="w-full">
          {t('nav.login')}
        </Button>
      </form>
      <div className="mt-4 flex flex-wrap justify-between gap-2 text-sm">
        <Link to="/forgot-password" className="text-indigo-600 underline">
          {t('auth.forgot')}
        </Link>
        <span>
          {t('auth.noAccount')}{' '}
          <Link to="/register" className="text-indigo-600 underline">
            {t('nav.register')}
          </Link>
        </span>
      </div>
    </Card>
  );
}
