import {
  isoToLocalDate,
  isoToLocalTime,
  localToIso,
  minutesToTime,
  timeOptions,
  toMinutes,
} from './time';

describe('time helpers', () => {
  it('генерирует слоты по 30 минут с 08:00', () => {
    const starts = timeOptions(false);
    expect(starts[0]).toBe('08:00');
    expect(starts[1]).toBe('08:30');
    expect(starts[starts.length - 1]).toBe('19:30');
    expect(timeOptions(true).pop()).toBe('20:00');
  });

  it('переводит время в минуты и обратно', () => {
    expect(toMinutes('10:30')).toBe(630);
    expect(minutesToTime(630)).toBe('10:30');
  });

  it('локальные дата и время превращаются в ISO и обратно без потерь', () => {
    const iso = localToIso('2026-10-22', '10:30');
    expect(isoToLocalDate(iso)).toBe('2026-10-22');
    expect(isoToLocalTime(iso)).toBe('10:30');
  });
});
