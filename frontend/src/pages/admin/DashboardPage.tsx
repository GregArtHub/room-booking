import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../../api/client';
import type { DashboardStats } from '../../api/types';
import { Card, EmptyState, ErrorState, Input, PageLoader } from '../../components/ui';

function shiftDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </Card>
  );
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const [from, setFrom] = useState(shiftDate(-7));
  const [to, setTo] = useState(shiftDate(13));
  const validRange = !!from && !!to && from <= to;

  const stats = useQuery({
    queryKey: ['stats', from, to],
    queryFn: () => api.get<{ data: DashboardStats }>('/stats/dashboard', { from, to }),
    enabled: validRange,
  });
  const data = stats.data?.data;
  const tick = { fill: 'currentColor', fontSize: 12 };

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">{t('dashboard.title')}</h1>
      <div className="mb-6 grid max-w-md grid-cols-2 gap-3">
        <Input
          label={t('dashboard.from')}
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <Input
          label={t('dashboard.to')}
          type="date"
          value={to}
          min={from}
          onChange={(e) => setTo(e.target.value)}
          error={!validRange ? t('dashboard.badRange') : undefined}
        />
      </div>

      {!validRange ? null : stats.isLoading ? (
        <PageLoader />
      ) : stats.isError ? (
        <ErrorState onRetry={() => stats.refetch()} />
      ) : !data || data.totalBookings === 0 ? (
        <EmptyState title={t('dashboard.none')} />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label={t('dashboard.total')} value={data.totalBookings} />
            <Stat
              label={t('dashboard.avg')}
              value={t('dashboard.minutes', { count: data.averageDurationMinutes })}
            />
            <Stat
              label={t('dashboard.topRoom')}
              value={data.topRoom ? `${data.topRoom.name} (${data.topRoom.bookings})` : '—'}
            />
          </div>

          <Card>
            <h2 className="mb-3 font-semibold">{t('dashboard.byDay')}</h2>
            <div className="h-64 text-slate-600 dark:text-slate-300">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.byDay} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="date" tick={tick} tickFormatter={(d: string) => d.slice(5)} />
                  <YAxis allowDecimals={false} tick={tick} />
                  <Tooltip />
                  <Bar
                    dataKey="bookings"
                    name={t('dashboard.bookings')}
                    fill="#4f46e5"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold">{t('dashboard.byRoom')}</h2>
            <div className="h-64 text-slate-600 dark:text-slate-300">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.byRoom} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="name" tick={tick} />
                  <YAxis tick={tick} />
                  <Tooltip />
                  <Bar
                    dataKey="hoursBooked"
                    name={t('dashboard.hours')}
                    fill="#0891b2"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
