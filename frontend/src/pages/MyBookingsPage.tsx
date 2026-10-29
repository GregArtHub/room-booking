import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import type { Booking, BookingStatus, Paginated } from '../api/types';
import { BookingForm } from '../components/BookingForm';
import { useToast } from '../components/Toast';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Modal,
  PageLoader,
  Pagination,
  Select,
} from '../components/ui';
import { formatRange, isoToLocalDate, isoToLocalTime } from '../lib/time';

const LIMIT = 5;

export default function MyBookingsPage() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<'' | BookingStatus>('');
  const [sort, setSort] = useState('-startsAt');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [cancelling, setCancelling] = useState<Booking | null>(null);

  const params = { status, sort, page, limit: LIMIT };
  const bookings = useQuery({
    queryKey: ['my-bookings', params],
    queryFn: () => api.get<Paginated<Booking>>('/bookings/my', params),
    placeholderData: (prev) => prev,
  });

  const cancel = useMutation({
    mutationFn: (id: number) => api.del(`/bookings/${id}`),
    onSuccess: () => {
      toast.push(t('booking.cancelled'));
      setCancelling(null);
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['availability'] });
    },
    onError: (err) => {
      toast.push(errorMessage(err, t('common.somethingWrong')), 'error');
      setCancelling(null);
    },
  });

  const isUpcoming = (b: Booking) =>
    b.status === 'ACTIVE' && new Date(b.startsAt).getTime() > Date.now();

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">{t('my.title')}</h1>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Select
          label={t('my.status')}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as '' | BookingStatus);
            setPage(1);
          }}
        >
          <option value="">{t('common.all')}</option>
          <option value="ACTIVE">{t('my.active')}</option>
          <option value="CANCELLED">{t('my.cancelledStatus')}</option>
        </Select>
        <Select
          label={t('rooms.sort')}
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            setPage(1);
          }}
        >
          <option value="-startsAt">{t('my.sortNew')}</option>
          <option value="startsAt">{t('my.sortOld')}</option>
        </Select>
      </div>
      <p className="mb-4 text-sm text-slate-500">{t('my.canEditHint')}</p>

      {bookings.isLoading ? (
        <PageLoader />
      ) : bookings.isError ? (
        <ErrorState onRetry={() => bookings.refetch()} />
      ) : bookings.data && bookings.data.data.length === 0 ? (
        <EmptyState
          title={t('my.empty')}
          hint={t('my.emptyHint')}
          action={
            <Link
              to="/rooms"
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              {t('nav.rooms')}
            </Link>
          }
        />
      ) : (
        <>
          <ul className="space-y-3">
            {bookings.data?.data.map((b) => (
              <li key={b.id}>
                <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">{b.title}</h2>
                      <Badge tone={b.status === 'ACTIVE' ? 'green' : 'red'}>
                        {b.status === 'ACTIVE' ? t('my.active') : t('my.cancelledStatus')}
                      </Badge>
                    </div>
                    <p className="text-sm">
                      <Link to={`/rooms/${b.room.id}`} className="text-indigo-600 underline">
                        {b.room.name}
                      </Link>{' '}
                      · {formatRange(b.startsAt, b.endsAt, i18n.language)}
                    </p>
                  </div>
                  {isUpcoming(b) && (
                    <div className="flex gap-2">
                      <Button variant="secondary" onClick={() => setEditing(b)}>
                        {t('common.edit')}
                      </Button>
                      <Button variant="danger" onClick={() => setCancelling(b)}>
                        {t('my.cancel')}
                      </Button>
                    </div>
                  )}
                </Card>
              </li>
            ))}
          </ul>
          {bookings.data && (
            <Pagination
              page={page}
              limit={LIMIT}
              total={bookings.data.meta.total}
              onChange={setPage}
            />
          )}
        </>
      )}

      <Modal open={!!editing} title={t('my.editTitle')} onClose={() => setEditing(null)}>
        {editing && (
          <BookingForm
            roomId={editing.room.id}
            excludeBookingId={editing.id}
            initial={{
              title: editing.title,
              date: isoToLocalDate(editing.startsAt),
              start: isoToLocalTime(editing.startsAt),
              end: isoToLocalTime(editing.endsAt),
            }}
            submitLabel={t('booking.update')}
            onCancel={() => setEditing(null)}
            onSubmit={async (payload) => {
              await api.patch(`/bookings/${editing.id}`, payload);
              toast.push(t('booking.updated'));
              setEditing(null);
              queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
              queryClient.invalidateQueries({ queryKey: ['availability'] });
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={!!cancelling}
        title={t('my.cancelTitle')}
        message={t('my.cancelMessage', { title: cancelling?.title ?? '' })}
        confirmLabel={t('my.cancelConfirm')}
        cancelLabel={t('my.keep')}
        loading={cancel.isPending}
        onConfirm={() => cancelling && cancel.mutate(cancelling.id)}
        onCancel={() => setCancelling(null)}
      />
    </div>
  );
}
