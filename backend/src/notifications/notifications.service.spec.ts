import { Test } from '@nestjs/testing';
import { AppException } from '../common/app-exception';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return 'OK';
  } catch (e) {
    return e instanceof AppException ? e.code : `ERR:${String(e)}`;
  }
}

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: any;
  let gateway: { emitToUser: jest.Mock };
  const booking = { title: 'Sync', userId: 1, room: { name: 'Everest' } };

  beforeEach(async () => {
    let id = 0;
    prisma = {
      user: { findMany: jest.fn() },
      notification: {
        create: jest.fn(({ data }: any) => Promise.resolve({ id: ++id, ...data })),
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    gateway = { emitToUser: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsGateway, useValue: gateway },
      ],
    }).compile();
    service = moduleRef.get(NotificationsService);
  });

  it('действие сотрудника: уведомляются администраторы, но не сам сотрудник', async () => {
    prisma.user.findMany.mockResolvedValue([{ id: 99 }, { id: 98 }]);
    await service.notifyBooking('BOOKING_CREATED', booking, 1);
    expect(prisma.notification.create).toHaveBeenCalledTimes(2);
    expect(gateway.emitToUser).toHaveBeenCalledTimes(2);
    const ids = gateway.emitToUser.mock.calls.map((c) => c[0]).sort();
    expect(ids).toEqual([98, 99]);
  });

  it('действие администратора: уведомляются владелец брони и другие администраторы', async () => {
    prisma.user.findMany.mockResolvedValue([{ id: 99 }, { id: 98 }]);
    await service.notifyBooking('BOOKING_CANCELLED', booking, 99);
    const ids = gateway.emitToUser.mock.calls.map((c) => c[0]).sort();
    expect(ids).toEqual([1, 98]);
    expect(prisma.notification.create.mock.calls[0][0].data.text).toBe('Everest: Sync');
  });

  it('нет получателей: ничего не сохраняется', async () => {
    prisma.user.findMany.mockResolvedValue([]);
    await service.notifyBooking('BOOKING_UPDATED', booking, 1);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(gateway.emitToUser).not.toHaveBeenCalled();
  });

  it('list фильтрует по пользователю и непрочитанным', async () => {
    prisma.notification.findMany.mockResolvedValue([]);
    prisma.notification.count.mockResolvedValue(0);
    const result = await service.list(5, { page: 1, limit: 10, unread: true });
    expect(prisma.notification.findMany.mock.calls[0][0].where).toEqual({
      userId: 5,
      isRead: false,
    });
    expect(result.meta.total).toBe(0);
  });

  it('markRead: чужое или несуществующее уведомление даёт 404', async () => {
    prisma.notification.findFirst.mockResolvedValue(null);
    expect(await codeOf(service.markRead(5, 10))).toBe('NOTIFICATION_NOT_FOUND');
  });

  it('markRead отмечает своё уведомление прочитанным', async () => {
    prisma.notification.findFirst.mockResolvedValue({ id: 10, userId: 5 });
    prisma.notification.update.mockResolvedValue({ id: 10, isRead: true });
    const result = await service.markRead(5, 10);
    expect(result.isRead).toBe(true);
    expect(prisma.notification.findFirst).toHaveBeenCalledWith({ where: { id: 10, userId: 5 } });
  });
});
