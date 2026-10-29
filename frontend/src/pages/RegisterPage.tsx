import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { errorMessage, fieldErrors } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Button, Card, Input } from '../components/ui';
import { isEmail } from '../lib/validation';

export default function RegisterPage() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (fullName.trim().length < 2) next.fullName = t('auth.nameMin');
    if (!isEmail(email)) next.email = t('auth.invalidEmail');
    if (password.length < 8) next.password = t('auth.passwordMin');
    setErrors(next);
    setFormError('');
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    try {
      await register(email.trim().toLowerCase(), password, fullName.trim());
      navigate('/rooms', { replace: true });
    } catch (err) {
      setErrors(fieldErrors(err));
      setFormError(errorMessage(err, t('auth.registerFailed')));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mx-auto max-w-md">
      <h1 className="mb-4 text-2xl font-bold">{t('auth.registerTitle')}</h1>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Input
          label={t('auth.fullName')}
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          error={errors.fullName}
        />
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
          autoComplete="new-password"
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
          {t('nav.register')}
        </Button>
      </form>
      <p className="mt-4 text-sm">
        {t('auth.haveAccount')}{' '}
        <Link to="/login" className="text-indigo-600 underline">
          {t('nav.login')}
        </Link>
      </p>
    </Card>
  );
}
