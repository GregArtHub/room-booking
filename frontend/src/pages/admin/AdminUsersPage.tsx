import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, errorMessage } from '../../api/client';
import type { Paginated, User } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../components/Toast';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Input,
  PageLoader,
  Pagination,
  Select,
} from '../../components/ui';
import { useDebounce } from '../../lib/useDebounce';

const LIMIT = 10;

export default function AdminUsersPage() {
  const { t } = useTranslation();
  const { user: me } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [blocking, setBlocking] = useState<User | null>(null);
  const debounced = useDebounce(search);

  const params = { search: debounced.trim(), role, page, limit: LIMIT, sort: '-createdAt' };
  const users = useQuery({
    queryKey: ['users', params],
    queryFn: () => api.get<Paginated<User>>('/users', params),
    placeholderData: (prev) => prev,
  });

  const onError = (err: unknown) =>
    toast.push(errorMessage(err, t('common.somethingWrong')), 'error');
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['users'] });

  const changeRole = useMutation({
    mutationFn: ({ id, role: next }: { id: number; role: string }) =>
      api.patch(`/users/${id}/role`, { role: next }),
    onSuccess: () => {
      toast.push(t('common.saved'));
      refresh();
    },
    onError,
  });

  const setBlocked = useMutation({
    mutationFn: ({ id, blocked }: { id: number; blocked: boolean }) =>
      api.patch(`/users/${id}/block`, { blocked }),
    onSuccess: () => {
      toast.push(t('common.saved'));
      setBlocking(null);
      refresh();
    },
    onError: (err) => {
      onError(err);
      setBlocking(null);
    },
  });

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">{t('adminUsers.title')}</h1>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Input
          label={t('common.search')}
          placeholder={t('adminUsers.searchPlaceholder')}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <Select
          label={t('adminUsers.role')}
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setPage(1);
          }}
        >
          <option value="">{t('adminUsers.allRoles')}</option>
          <option value="employee">{t('adminUsers.employee')}</option>
          <option value="admin">{t('adminUsers.admin')}</option>
        </Select>
      </div>

      {users.isLoading ? (
        <PageLoader />
      ) : users.isError ? (
        <ErrorState onRetry={() => users.refetch()} />
      ) : users.data && users.data.data.length === 0 ? (
        <EmptyState title={t('adminUsers.empty')} />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-700">
                <tr>
                  <th className="px-4 py-3">{t('adminUsers.user')}</th>
                  <th className="px-4 py-3">{t('adminUsers.role')}</th>
                  <th className="px-4 py-3">{t('adminUsers.status')}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {users.data?.data.map((u) => {
                  const isSelf = u.id === me?.id;
                  const currentRole = u.roles.includes('admin') ? 'admin' : 'employee';
                  return (
                    <tr
                      key={u.id}
                      className="border-b border-slate-100 last:border-0 dark:border-slate-700"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">{u.fullName}</div>
                        <div className="text-slate-500">{u.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          aria-label={`${t('adminUsers.role')}: ${u.fullName}`}
                          value={currentRole}
                          disabled={isSelf || changeRole.isPending}
                          onChange={(e) => changeRole.mutate({ id: u.id, role: e.target.value })}
                          className="rounded-md border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
                        >
                          <option value="employee">{t('adminUsers.employee')}</option>
                          <option value="admin">{t('adminUsers.admin')}</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={u.isBlocked ? 'red' : 'green'}>
                          {u.isBlocked ? t('adminUsers.blocked') : t('adminUsers.active')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {u.isBlocked ? (
                          <Button
                            variant="secondary"
                            onClick={() => setBlocked.mutate({ id: u.id, blocked: false })}
                          >
                            {t('adminUsers.unblock')}
                          </Button>
                        ) : (
                          <Button variant="danger" disabled={isSelf} onClick={() => setBlocking(u)}>
                            {t('adminUsers.block')}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {users.data && (
            <Pagination
              page={page}
              limit={LIMIT}
              total={users.data.meta.total}
              onChange={setPage}
            />
          )}
        </>
      )}

      <ConfirmDialog
        open={!!blocking}
        title={t('adminUsers.blockTitle')}
        message={t('adminUsers.blockMessage', { name: blocking?.fullName ?? '' })}
        confirmLabel={t('adminUsers.block')}
        loading={setBlocked.isPending}
        onConfirm={() => blocking && setBlocked.mutate({ id: blocking.id, blocked: true })}
        onCancel={() => setBlocking(null)}
      />
    </div>
  );
}
