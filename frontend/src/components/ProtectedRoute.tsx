import { useTranslation } from 'react-i18next';
import { Link, Navigate, useLocation } from 'react-router-dom';
import type { RoleName } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { PageLoader } from './ui';

/** Защита маршрутов на клиенте (настоящая проверка прав выполняется на сервере). */
export function ProtectedRoute({ roles, children }: { roles?: RoleName[]; children: JSX.Element }) {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (roles && !roles.some((r) => user.roles.includes(r))) {
    return (
      <div className="py-16 text-center">
        <p className="text-lg font-medium">{t('common.forbidden')}</p>
        <Link to="/rooms" className="mt-3 inline-block text-indigo-600 underline">
          {t('common.toHome')}
        </Link>
      </div>
    );
  }
  return children;
}
