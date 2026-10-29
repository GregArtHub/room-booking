import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { io } from 'socket.io-client';
import { api, tokenStore } from '../api/client';
import type { AppNotification, Paginated } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { formatDateTime } from '../lib/time';
import { Button } from './ui';
import { useToast } from './Toast';

/** Колокольчик уведомлений: список из REST + новые события по WebSocket (Socket.IO). */
export function NotificationBell() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const list = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => api.get<Paginated<AppNotification>>('/notifications', { limit: 15 }),
  });
  const unread = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () =>
      api.get<Paginated<AppNotification>>('/notifications', { limit: 1, unread: true }),
  });

  useEffect(() => {
    if (!user) return;
    const socket = io({ auth: (cb) => cb({ token: tokenStore.access }) });
    socket.on('notification', (n: AppNotification) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['availability'] });
      toast.push(`${t(`notifications.${n.type}`)}: ${n.text}`, 'info');
    });
    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const markRead = useMutation({
    mutationFn: (id: number) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const count = unread.data?.meta.total ?? 0;

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={t('notifications.title')}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-md p-2 hover:bg-slate-200 dark:hover:bg-slate-700"
      >
        <span aria-hidden="true">🔔</span>
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-w-[1.25rem] rounded-full bg-red-600 px-1 text-center text-xs font-semibold text-white">
            {count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 max-h-96 w-[calc(100vw-1.5rem)] max-w-sm overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-800">
          <h3 className="mb-2 font-semibold">{t('notifications.title')}</h3>
          {list.data?.data.length ? (
            <ul className="space-y-2">
              {list.data.data.map((n) => (
                <li
                  key={n.id}
                  className={`rounded-md border p-2 text-sm ${n.isRead ? 'border-slate-200 opacity-70 dark:border-slate-700' : 'border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-950'}`}
                >
                  <p className="font-medium">{t(`notifications.${n.type}`)}</p>
                  <p>{n.text}</p>
                  <div className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span>{formatDateTime(n.createdAt, i18n.language)}</span>
                    {!n.isRead && (
                      <Button
                        variant="ghost"
                        className="px-2 py-1 text-xs"
                        onClick={() => markRead.mutate(n.id)}
                      >
                        {t('notifications.markRead')}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-center text-sm text-slate-500">{t('notifications.empty')}</p>
          )}
        </div>
      )}
    </div>
  );
}
