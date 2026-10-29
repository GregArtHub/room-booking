import { Test } from '@nestjs/testing';
import { AppException } from '../common/app-exception';
import { PrismaService } from '../common/prisma/prisma.service';
import { StatsService } from './stats.service';

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return 'OK';
  } catch (e) {
    return e instanceof AppException ? e.code : `ERR:${String(e)}`;
  }
}

const b = (roomId: number, name: string, start: string, end: string) => ({
  startsAt: new Date(start),
  endsAt: new Date(end),
  room: { id: roomId, name },
});

describe('StatsService', () => {
  let service: StatsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = { booking: { findMany: jest.fn() } };
    const moduleRef = await Test.createTestingModule({
      providers: [StatsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(StatsService);
  });

  it('считает сводку, самую популярную комнату и график по дням', async () => {
    prisma.booking.findMany.mockResolvedValue([
      b(1, 'Everest', '2026-10-22T10:00:00Z', '2026-10-22T11:00:00Z'),
      b(1, 'Everest', '2026-10-22T12:00:00Z', '2026-10-22T13:00:00Z'),
      b(2, 'Elbrus', '2026-10-22T14:00:00Z', '2026-10-22T16:00:00Z'),
    ]);

    const stats = await service.dashboard({ from: '2026-10-21', to: '2026-10-23' });

    expect(stats.totalBookings).toBe(3);
    expect(stats.averageDurationMinutes).toBe(80);
    expect(stats.topRoom).toEqual({ roomId: 1, name: 'Everest', bookings: 2 });
    expect(stats.byDay).toEqual([
      { date: '2026-10-21', bookings: 0 },
      { date: '2026-10-22', bookings: 3 },
      { date: '2026-10-23', bookings: 0 },
    ]);
    expect(stats.byRoom).toEqual([
      { roomId: 1, name: 'Everest', hoursBooked: 2 },
      { roomId: 2, name: 'Elbrus', hoursBooked: 2 },
    ]);
  });

  it('для пустого периода возвращает нули и topRoom = null', async () => {
    prisma.booking.findMany.mockResolvedValue([]);
    const stats = await service.dashboard({ from: '2026-10-22', to: '2026-10-22' });
    expect(stats.totalBookings).toBe(0);
    expect(stats.averageDurationMinutes).toBe(0);
    expect(stats.topRoom).toBeNull();
    expect(stats.byDay).toHaveLength(1);
  });

  it('отклоняет период, где конец раньше начала', async () => {
    expect(await codeOf(service.dashboard({ from: '2026-10-23', to: '2026-10-22' }))).toBe(
      'VALIDATION_ERROR',
    );
  });

  it('отклоняет слишком длинный период', async () => {
    expect(await codeOf(service.dashboard({ from: '2024-01-01', to: '2026-01-01' }))).toBe(
      'VALIDATION_ERROR',
    );
  });
});
