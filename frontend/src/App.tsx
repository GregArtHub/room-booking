import { useTranslation } from 'react-i18next';
import { Link, Route, Routes, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import AdminRoomsPage from './pages/admin/AdminRoomsPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import DashboardPage from './pages/admin/DashboardPage';
import { ForgotPasswordPage, ResetPasswordPage } from './pages/PasswordPages';
import LoginPage from './pages/LoginPage';
import MyBookingsPage from './pages/MyBookingsPage';
import ProfilePage from './pages/ProfilePage';
import RegisterPage from './pages/RegisterPage';
import RoomDetailPage from './pages/RoomDetailPage';
import RoomsPage from './pages/RoomsPage';

function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="py-16 text-center">
      <p className="text-lg font-medium">{t('common.notFound')}</p>
      <Link to="/rooms" className="mt-3 inline-block text-indigo-600 underline">
        {t('common.toHome')}
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/rooms" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/rooms" element={<RoomsPage />} />
        <Route path="/rooms/:id" element={<RoomDetailPage />} />
        <Route
          path="/my-bookings"
          element={
            <ProtectedRoute>
              <MyBookingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/rooms"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminRoomsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminUsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute roles={['admin']}>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
