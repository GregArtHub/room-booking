export const DAY_START_HOUR = 8;
export const DAY_END_HOUR = 20;
export const STEP_MIN = 30;
export const MAX_DURATION_MIN = 240;

const pad = (n: number) => String(n).padStart(2, '0');

/** Время слотов "08:00", "08:30", ... до конца рабочего дня (включительно, для выбора окончания). */
export function timeOptions(includeEnd: boolean): string[] {
  const result: string[] = [];
  for (let m = DAY_START_HOUR * 60; m <= DAY_END_HOUR * 60; m += STEP_MIN) {
    if (!includeEnd && m === DAY_END_HOUR * 60) continue;
    result.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
  }
  return result;
}

export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** Локальные дата "YYYY-MM-DD" и время "HH:mm" -> ISO в UTC. */
export function localToIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

export function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isoToLocalDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isoToLocalTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Смещение часового пояса клиента в минутах к востоку от UTC. */
export function tzOffsetMinutes(): number {
  return -new Date().getTimezoneOffset();
}

export function formatRange(startIso: string, endIso: string, locale: string): string {
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' });
  const s = new Date(startIso);
  const e = new Date(endIso);
  return `${date.format(s)}, ${time.format(s)}–${time.format(e)}`;
}

export function formatDateTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

export function minutesToTime(total: number): string {
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}
