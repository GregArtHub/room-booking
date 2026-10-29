import { useQuery } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, errorMessage, fieldErrors } from '../api/client';
import type { BusySlot } from '../api/types';
import {
  localToIso,
  MAX_DURATION_MIN,
  minutesToTime,
  timeOptions,
  todayLocal,
  toMinutes,
  tzOffsetMinutes,
  DAY_END_HOUR,
} from '../lib/time';
import { AvailabilityGrid } from './AvailabilityGrid';
import { Button, Input, PageLoader, Select } from './ui';

export interface BookingFormValues {
  title: string;
  date: string;
  start: string;
  end: string;
}

interface Props {
  roomId: number;
  initial?: BookingFormValues;
  excludeBookingId?: number;
  submitLabel: string;
  onSubmit: (payload: { title: string; startsAt: string; endsAt: string }) => Promise<void>;
  onCancel?: () => void;
}

export function BookingForm({
  roomId,
  initial,
  excludeBookingId,
  submitLabel,
  onSubmit,
  onCancel,
}: Props) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [date, setDate] = useState(initial?.date ?? todayLocal());
  const [start, setStart] = useState(initial?.start ?? '10:00');
  const [end, setEnd] = useState(initial?.end ?? '11:00');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const availability = useQuery({
    queryKey: ['availability', roomId, date],
    queryFn: () =>
      api.get<{ data: BusySlot[] }>(`/rooms/${roomId}/availability`, {
        date,
        offset: tzOffsetMinutes(),
      }),
    enabled: !!date,
  });
  const busy = availability.data?.data ?? [];

  const endOptions = timeOptions(true).filter(
    (time) =>
      toMinutes(time) > toMinutes(start) && toMinutes(time) <= toMinutes(start) + MAX_DURATION_MIN,
  );

  function changeStart(value: string) {
    setStart(value);
    if (
      toMinutes(end) <= toMinutes(value) ||
      toMinutes(end) > toMinutes(value) + MAX_DURATION_MIN
    ) {
      setEnd(minutesToTime(Math.min(toMinutes(value) + 30, DAY_END_HOUR * 60)));
    }
  }

  function pickSlot(time: string) {
    setStart(time);
    setEnd(minutesToTime(Math.min(toMinutes(time) + 30, DAY_END_HOUR * 60)));
  }

  function validate(): Record<string, string> {
    const next: Record<string, string> = {};
    const len = title.trim().length;
    if (len < 2 || len > 150) next.title = t('booking.titleLength');
    const startMs = new Date(localToIso(date, start)).getTime();
    const endMs = new Date(localToIso(date, end)).getTime();
    if (endMs <= startMs) next.end = t('booking.endAfterStart');
    else if ((endMs - startMs) / 60_000 > MAX_DURATION_MIN) next.end = t('booking.maxDuration');
    if (startMs < Date.now()) next.start = t('booking.inPast');
    const clash = busy.some(
      (b) =>
        b.id !== excludeBookingId &&
        new Date(b.startsAt).getTime() < endMs &&
        new Date(b.endsAt).getTime() > startMs,
    );
    if (clash && !next.end) next.end = t('booking.overlap');
    return next;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    setFormError('');
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    try {
      await onSubmit({
        title: title.trim(),
        startsAt: localToIso(date, start),
        endsAt: localToIso(date, end),
      });
    } catch (err) {
      const server = fieldErrors(err);
      setErrors({
        title: server.title ?? '',
        start: server.startsAt ?? '',
        end: server.endsAt ?? '',
      });
      setFormError(errorMessage(err, t('booking.failed')));
      availability.refetch();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <Input
        label={t('booking.meetingTitle')}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        error={errors.title}
        maxLength={150}
      />
      <Input
        label={t('booking.date')}
        type="date"
        value={date}
        min={todayLocal()}
        onChange={(e) => setDate(e.target.value)}
      />

      {availability.isLoading ? (
        <PageLoader />
      ) : (
        <AvailabilityGrid
          date={date}
          busy={busy}
          excludeId={excludeBookingId}
          start={start}
          end={end}
          onPick={pickSlot}
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        <Select
          label={t('booking.start')}
          value={start}
          onChange={(e) => changeStart(e.target.value)}
          error={errors.start}
        >
          {timeOptions(false).map((time) => (
            <option key={time} value={time}>
              {time}
            </option>
          ))}
        </Select>
        <Select
          label={t('booking.end')}
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          error={errors.end}
        >
          {endOptions.map((time) => (
            <option key={time} value={time}>
              {time}
            </option>
          ))}
        </Select>
      </div>

      {formError && (
        <p
          role="alert"
          className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200"
        >
          {formError}
        </p>
      )}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
        )}
        <Button type="submit" loading={loading}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
