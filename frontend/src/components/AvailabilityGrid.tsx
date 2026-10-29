import { useTranslation } from 'react-i18next';
import type { BusySlot } from '../api/types';
import { timeOptions } from '../lib/time';

interface Props {
  date: string;
  busy: BusySlot[];
  excludeId?: number;
  start?: string;
  end?: string;
  onPick?: (time: string) => void;
}

/** Календарь слотов на день: занятые, свободные и выбранные интервалы по 30 минут. */
export function AvailabilityGrid({ date, busy, excludeId, start, end, onPick }: Props) {
  const { t } = useTranslation();
  const now = Date.now();

  return (
    <div>
      <ul
        className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6"
        aria-label={t('booking.schedule')}
      >
        {timeOptions(false).map((time) => {
          const slotStart = new Date(`${date}T${time}:00`).getTime();
          const slotEnd = slotStart + 30 * 60_000;
          const isBusy = busy.some(
            (b) =>
              b.id !== excludeId &&
              new Date(b.startsAt).getTime() < slotEnd &&
              new Date(b.endsAt).getTime() > slotStart,
          );
          const inPast = slotStart < now;
          const selected = !!start && !!end && time >= start && time < end;
          const disabled = isBusy || inPast || !onPick;

          let tone =
            'border-green-300 bg-green-50 text-green-900 hover:bg-green-100 dark:border-green-800 dark:bg-green-950 dark:text-green-100';
          if (isBusy)
            tone =
              'border-red-300 bg-red-100 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100';
          else if (inPast)
            tone =
              'border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-700 dark:bg-slate-800';
          if (selected) tone = 'border-indigo-600 bg-indigo-600 text-white';

          return (
            <li key={time}>
              <button
                type="button"
                disabled={disabled && !selected}
                onClick={() => onPick?.(time)}
                aria-label={`${time} — ${isBusy ? t('booking.busy') : selected ? t('booking.selected') : t('booking.free')}`}
                className={`w-full rounded-md border px-2 py-1.5 text-sm ${tone} disabled:cursor-not-allowed`}
              >
                {time}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600 dark:text-slate-300">
        <span className="flex items-center gap-1">
          <i className="inline-block h-3 w-3 rounded bg-green-300" />
          {t('booking.free')}
        </span>
        <span className="flex items-center gap-1">
          <i className="inline-block h-3 w-3 rounded bg-red-300" />
          {t('booking.busy')}
        </span>
        <span className="flex items-center gap-1">
          <i className="inline-block h-3 w-3 rounded bg-indigo-600" />
          {t('booking.selected')}
        </span>
      </div>
    </div>
  );
}
