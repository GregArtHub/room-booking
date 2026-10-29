import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import type { BusySlot, Room } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { AvailabilityGrid } from '../components/AvailabilityGrid';
import { BookingForm } from '../components/BookingForm';
import { RoomPhoto } from '../components/RoomCard';
import { useToast } from '../components/Toast';
import { Badge, Card, ErrorState, Input, PageLoader } from '../components/ui';
import { todayLocal, tzOffsetMinutes } from '../lib/time';

export default function RoomDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const roomId = Number(id);
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [guestDate, setGuestDate] = useState(todayLocal());

  const room = useQuery({
    queryKey: ['room', roomId],
    queryFn: () => api.get<{ data: Room }>(`/rooms/${roomId}`),
    enabled: Number.isInteger(roomId),
    retry: false,
  });

  const guestAvailability = useQuery({
    queryKey: ['availability', roomId, guestDate],
    queryFn: () =>
      api.get<{ data: BusySlot[] }>(`/rooms/${roomId}/availability`, {
        date: guestDate,
        offset: tzOffsetMinutes(),
      }),
    enabled: !user && Number.isInteger(roomId),
  });

  if (room.isLoading) return <PageLoader />;
  if (room.isError || !room.data) {
    return (
      <ErrorState
        message={errorMessage(room.error, t('rooms.notFound'))}
        onRetry={() => room.refetch()}
      />
    );
  }
  const r = room.data.data;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <Link to="/rooms" className="text-sm text-indigo-600 underline">
          ← {t('nav.rooms')}
        </Link>
        <RoomPhoto room={r} className="h-64" />
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{r.name}</h1>
            {!r.isActive && <Badge tone="slate">{t('rooms.inactive')}</Badge>}
          </div>
          <p className="mt-1 text-slate-600 dark:text-slate-300">
            {t('rooms.seats', { count: r.capacity })} · {t('rooms.floorLabel', { count: r.floor })}
          </p>
          {r.description && <p className="mt-3">{r.description}</p>}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {r.amenities.map((a) => (
              <Badge key={a.id} tone="indigo">
                {a.name}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <Card>
        <h2 className="mb-4 text-lg font-semibold">{t('booking.schedule')}</h2>
        {user && r.isActive ? (
          <BookingForm
            roomId={r.id}
            submitLabel={t('booking.submit')}
            onSubmit={async (payload) => {
              await api.post('/bookings', { roomId: r.id, ...payload });
              queryClient.invalidateQueries({ queryKey: ['availability'] });
              queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
              toast.push(t('booking.created'));
              navigate('/my-bookings');
            }}
          />
        ) : (
          <div className="space-y-4">
            <Input
              label={t('booking.date')}
              type="date"
              value={guestDate}
              min={todayLocal()}
              onChange={(e) => setGuestDate(e.target.value)}
            />
            {guestAvailability.isLoading ? (
              <PageLoader />
            ) : (
              <AvailabilityGrid date={guestDate} busy={guestAvailability.data?.data ?? []} />
            )}
            {!user && (
              <p className="text-sm">
                <Link
                  to="/login"
                  state={{ from: `/rooms/${r.id}` }}
                  className="text-indigo-600 underline"
                >
                  {t('booking.loginToBook')}
                </Link>
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
