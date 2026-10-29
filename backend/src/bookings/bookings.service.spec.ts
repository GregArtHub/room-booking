import { Test } from '@nestjs/testing';
import { BookingStatus } from '@prisma/client';
import { AppException } from '../common/app-exception';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BookingsService, validateInterval } from './bookings.service';

const user: AuthUser = { id: 1, email: 'u@example.com', roles: ['employee'] };
const admin: AuthUser = { id: 99, email: 'a@example.com', roles: ['admin'] };

/** Слот, выровненный по 30 минутам, не менее чем через 2 часа от текущего момента. */
function slot(halfHoursAhead: number): Date {
  const d = new Date();
  d.setUTCMinutes(0, 0, 0);
  d.setUTCHours(d.getUTCHours() + 2);
  return new Date(d.getTime() + halfHoursAhead * 30 * 60_000);
}

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    roomId: 1,
    userId: 1,
    title: 'Sync',
    startsAt: slot(2),
    endsAt: slot(4),
    status: BookingStatus.ACTIVE,
    createdAt: new Date(),
    room: {
      id: 1,
      name: 'Everest',
      description: null,
      capacity: 8,
      floor: 1,
      photoUrl: null,
      isActive: true,
      amenities: [],
    },
    user: { id: 1, fullName: 'Ivan' },
    ...overrides,
  };
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return 'OK';
  } catch (e) {
    return e instanceof AppException ? e.code : `ERR:${String(e)}`;
  }
}

describe('BookingsService', () => {
  let service: BookingsService;
  let prisma: any;
  let notifications: { notifyBooking: jest.Mock };

  beforeEach(async () => {
    prisma = {
      room: { findUnique: jest.fn() },
      booking: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    notifications = { notifyBooking: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();
    service = moduleRef.get(BookingsService);
  });

  describe('validateInterval', () => {
    it('принимает корректный интервал', () => {
      expect(() => validateInterval(slot(2), slot(4))).not.toThrow();
    });

    it('отклоняет время не кратное 30 минутам', () => {
      const start = new Date(slot(2).getTime() + 15 * 60_000);
      expect(() => validateInterval(start, slot(6))).toThrow(AppException);
    });
  });

  describe('create', () => {
    const dto = (start: Date, end: Date) => ({
      roomId: 1,
      title: 'Planning',
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
    });

    it('отклоняет окончание не позже начала', async () => {
      expect(await codeOf(service.create(user, dto(slot(4), slot(4))))).toBe('VALIDATION_ERROR');
      expect(prisma.booking.create).not.toHaveBeenCalled();
    });

    it('отклоняет бронь в прошлом', async () => {
      const past = new Date(Date.now() - 3 * 3600_000);
      past.setUTCMinutes(0, 0, 0);
      const pastEnd = new Date(past.getTime() + 3600_000);
      expect(await codeOf(service.create(user, dto(past, pastEnd)))).toBe('VALIDATION_ERROR');
    });

    it('отклоняет бронь длиннее 4 часов', async () => {
      expect(await codeOf(service.create(user, dto(slot(2), slot(12))))).toBe('VALIDATION_ERROR');
    });

    it('возвращает 404, если комнаты нет', async () => {
      prisma.room.findUnique.mockResolvedValue(null);
      expect(await codeOf(service.create(user, dto(slot(2), slot(4))))).toBe('ROOM_NOT_FOUND');
    });

    it('возвращает 409, если комната неактивна', async () => {
      prisma.room.findUnique.mockResolvedValue({ id: 1, isActive: false });
      expect(await codeOf(service.create(user, dto(slot(2), slot(4))))).toBe('ROOM_INACTIVE');
    });

    it('запрещает пересечение с существующей бронью', async () => {
      prisma.room.findUnique.mockResolvedValue({ id: 1, isActive: true });
      prisma.booking.findFirst.mockResolvedValue({ id: 5 });
      expect(await codeOf(service.create(user, dto(slot(2), slot(4))))).toBe('BOOKING_OVERLAP');
      expect(prisma.booking.create).not.toHaveBeenCalled();
    });

    it('превращает ошибку ограничения БД в BOOKING_OVERLAP', async () => {
      prisma.room.findUnique.mockResolvedValue({ id: 1, isActive: true });
      prisma.booking.findFirst.mockResolvedValue(null);
      prisma.booking.create.mockRejectedValue(
        new Error('conflicting key value violates exclusion constraint "bookings_no_overlap"'),
      );
      expect(await codeOf(service.create(user, dto(slot(2), slot(4))))).toBe('BOOKING_OVERLAP');
    });

    it('создаёт бронь и отправляет уведомления', async () => {
      prisma.room.findUnique.mockResolvedValue({ id: 1, isActive: true });
      prisma.booking.findFirst.mockResolvedValue(null);
      const created = makeBooking();
      prisma.booking.create.mockResolvedValue(created);

      const result = await service.create(user, dto(slot(2), slot(4)));

      expect(result.id).toBe(10);
      expect(prisma.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: 1, roomId: 1 }) }),
      );
      expect(notifications.notifyBooking).toHaveBeenCalledWith('BOOKING_CREATED', created, 1);
    });
  });

  describe('update', () => {
    it('запрещает изменять чужую бронь (403)', async () => {
      prisma.booking.findUnique.mockResolvedValue(makeBooking({ userId: 2 }));
      expect(await codeOf(service.update(user, 10, { title: 'New title' }))).toBe('FORBIDDEN');
      expect(prisma.booking.update).not.toHaveBeenCalled();
    });

    it('возвращает 404 для несуществующей брони', async () => {
      prisma.booking.findUnique.mockResolvedValue(null);
      expect(await codeOf(service.update(user, 10, { title: 'x2' }))).toBe('BOOKING_NOT_FOUND');
    });

    it('запрещает менять начавшуюся бронь', async () => {
      const past = new Date(Date.now() - 3600_000);
      prisma.booking.findUnique.mockResolvedValue(makeBooking({ startsAt: past }));
      expect(await codeOf(service.update(user, 10, { title: 'New title' }))).toBe(
        'BOOKING_STARTED',
      );
    });

    it('запрещает менять отменённую бронь', async () => {
      prisma.booking.findUnique.mockResolvedValue(makeBooking({ status: BookingStatus.CANCELLED }));
      expect(await codeOf(service.update(user, 10, { title: 'New title' }))).toBe(
        'BOOKING_CANCELLED',
      );
    });

    it('обновляет бронь владельца и уведомляет', async () => {
      prisma.booking.findUnique.mockResolvedValue(makeBooking());
      prisma.booking.findFirst.mockResolvedValue(null);
      const updated = makeBooking({ title: 'New title' });
      prisma.booking.update.mockResolvedValue(updated);

      const result = await service.update(user, 10, { title: 'New title' });

      expect(result.title).toBe('New title');
      expect(notifications.notifyBooking).toHaveBeenCalledWith('BOOKING_UPDATED', updated, 1);
    });

    it('не считает саму бронь конфликтом при проверке пересечений', async () => {
      prisma.booking.findUnique.mockResolvedValue(makeBooking());
      prisma.booking.findFirst.mockResolvedValue(null);
      prisma.booking.update.mockResolvedValue(makeBooking());
      await service.update(user, 10, { title: 'Same slot' });
      expect(prisma.booking.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: { not: 10 } }),
        }),
      );
    });
  });

  describe('cancel', () => {
    it('администратор может отменить чужую бронь', async () => {
      const booking = makeBooking();
      prisma.booking.findUnique.mockResolvedValue(booking);
      const cancelled = makeBooking({ status: BookingStatus.CANCELLED });
      prisma.booking.update.mockResolvedValue(cancelled);

      await service.cancel(admin, 10);

      expect(prisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: BookingStatus.CANCELLED } }),
      );
      expect(notifications.notifyBooking).toHaveBeenCalledWith('BOOKING_CANCELLED', cancelled, 99);
    });

    it('сотрудник не может отменить чужую бронь', async () => {
      prisma.booking.findUnique.mockResolvedValue(makeBooking({ userId: 2 }));
      expect(await codeOf(service.cancel(user, 10))).toBe('FORBIDDEN');
    });

    it('повторная отмена ничего не делает', async () => {
      prisma.booking.findUnique.mockResolvedValue(makeBooking({ status: BookingStatus.CANCELLED }));
      await service.cancel(user, 10);
      expect(prisma.booking.update).not.toHaveBeenCalled();
    });

    it('нельзя отменить уже завершённую бронь', async () => {
      const past = new Date(Date.now() - 3600_000);
      prisma.booking.findUnique.mockResolvedValue(makeBooking({ endsAt: past }));
      expect(await codeOf(service.cancel(user, 10))).toBe('BOOKING_FINISHED');
    });
  });

  describe('списки', () => {
    it('listMy возвращает только брони текущего пользователя', async () => {
      prisma.booking.findMany.mockResolvedValue([makeBooking()]);
      prisma.booking.count.mockResolvedValue(1);

      const result = await service.listMy(user, { page: 1, limit: 10 } as any);

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ userId: 1 }) }),
      );
      expect(result.meta).toEqual({ page: 1, limit: 10, total: 1 });
      expect(result.data).toHaveLength(1);
    });

    it('listAll применяет фильтры администратора', async () => {
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.booking.count.mockResolvedValue(0);

      await service.listAll({ page: 2, limit: 5, roomId: 3, status: BookingStatus.ACTIVE } as any);

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ roomId: 3, status: BookingStatus.ACTIVE }),
          skip: 5,
          take: 5,
        }),
      );
    });
  });
});
