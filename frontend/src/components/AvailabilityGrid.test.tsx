import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { AvailabilityGrid } from './AvailabilityGrid';

function futureDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

describe('AvailabilityGrid', () => {
  it('помечает занятые слоты и блокирует их', () => {
    const date = futureDate();
    const busy = [
      {
        id: 1,
        startsAt: new Date(`${date}T10:00:00`).toISOString(),
        endsAt: new Date(`${date}T11:00:00`).toISOString(),
      },
    ];
    render(<AvailabilityGrid date={date} busy={busy} onPick={() => undefined} />);

    expect(screen.getByRole('button', { name: '10:00 — Занято' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '10:30 — Занято' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '11:00 — Свободно' })).toBeEnabled();
  });

  it('передаёт время выбранного свободного слота', async () => {
    const onPick = vi.fn();
    render(<AvailabilityGrid date={futureDate()} busy={[]} onPick={onPick} />);
    await userEvent.click(screen.getByRole('button', { name: '09:00 — Свободно' }));
    expect(onPick).toHaveBeenCalledWith('09:00');
  });

  it('не считает занятым слот собственной брони при редактировании', () => {
    const date = futureDate();
    const busy = [
      {
        id: 7,
        startsAt: new Date(`${date}T14:00:00`).toISOString(),
        endsAt: new Date(`${date}T15:00:00`).toISOString(),
      },
    ];
    render(<AvailabilityGrid date={date} busy={busy} excludeId={7} onPick={() => undefined} />);
    expect(screen.getByRole('button', { name: '14:00 — Свободно' })).toBeEnabled();
  });
});
