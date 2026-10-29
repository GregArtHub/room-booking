import { Test } from '@nestjs/testing';
import { AppException } from '../common/app-exception';
import { PrismaService } from '../common/prisma/prisma.service';
import { RoomsService } from './rooms.service';

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return 'OK';
  } catch (e) {
    return e instanceof AppException ? e.code : `ERR:${String(e)}`;
  }
}

const roomRow = {
  id: 1,
  name: 'Everest',
  description: 'Big room',
  capacity: 12,
  floor: 3,
  photoUrl: null,
  isActive: true,
  amenities: [{ amenity: { id: 1, name: 'Проектор' } }],
};

describe('RoomsService', () => {
  let service: RoomsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      room: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      booking: { count: jest.fn(), findMany: jest.fn(), deleteMany: jest.fn() },
      amenity: { findMany: jest.fn() },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [RoomsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(RoomsService);
  });

  describe('list', () => {
    beforeEach(() => {
      prisma.room.findMany.mockResolvedValue([roomRow]);
      prisma.room.count.mockResolvedValue(1);
    });

    it('для гостя показывает только активные комнаты и добавляет фильтры', async () => {
      const result = await service.list(
        { page: 1, limit: 10, search: 'ever', minCapacity: 8, amenities: '1,2' } as any,
        null,
      );

      const where = prisma.room.findMany.mock.calls[0][0].where;
      expect(where.AND).toContainEqual({ isActive: true });
      expect(where.AND).toContainEqual({ capacity: { gte: 8 } });
      expect(where.AND).toContainEqual({ amenities: { some: { amenityId: 1 } } });
      expect(where.AND).toContainEqual({ amenities: { some: { amenityId: 2 } } });
      expect(result.meta).toEqual({ page: 1, limit: 10, total: 1 });
      expect(result.data[0].amenities).toEqual([{ id: 1, name: 'Проектор' }]);
    });

    it('администратор с includeInactive видит и неактивные комнаты', async () => {
      await service.list({ page: 1, limit: 10, includeInactive: true } as any, {
        id: 1,
        email: 'a@example.com',
        roles: ['admin'],
      });
      const where = prisma.room.findMany.mock.calls[0][0].where;
      expect(where.AND).not.toContainEqual({ isActive: true });
    });

    it('обычный сотрудник не может включить неактивные комнаты', async () => {
      await service.list({ page: 1, limit: 10, includeInactive: true } as any, {
        id: 2,
        email: 'e@example.com',
        roles: ['employee'],
      });
      expect(prisma.room.findMany.mock.calls[0][0].where.AND).toContainEqual({ isActive: true });
    });

    it('считает skip/take для пагинации и сортирует по белому списку', async () => {
      await service.list({ page: 3, limit: 5, sort: '-capacity' } as any, null);
      const args = prisma.room.findMany.mock.calls[0][0];
      expect(args.skip).toBe(10);
      expect(args.take).toBe(5);
      expect(args.orderBy).toEqual({ capacity: 'desc' });
    });

    it('игнорирует недопустимое поле сортировки', async () => {
      await service.list({ page: 1, limit: 10, sort: 'passwordHash' } as any, null);
      expect(prisma.room.findMany.mock.calls[0][0].orderBy).toEqual({ name: 'asc' });
    });
  });

  describe('create / update', () => {
    it('create: 409 при занятом названии', async () => {
      prisma.room.findFirst.mockResolvedValue({ id: 3 });
      expect(await codeOf(service.create({ name: 'Everest', capacity: 4, floor: 1 }))).toBe(
        'ROOM_NAME_TAKEN',
      );
    });

    it('create: создаёт комнату с удобствами', async () => {
      prisma.room.findFirst.mockResolvedValue(null);
      prisma.room.create.mockResolvedValue(roomRow);
      const room = await service.create({
        name: 'Everest',
        capacity: 12,
        floor: 3,
        amenityIds: [1],
      });
      expect(room.name).toBe('Everest');
      expect(prisma.room.create.mock.calls[0][0].data.amenities).toEqual({
        create: [{ amenityId: 1 }],
      });
    });

    it('update: 404 для несуществующей комнаты', async () => {
      prisma.room.findUnique.mockResolvedValue(null);
      expect(await codeOf(service.update(5, { capacity: 4 }))).toBe('ROOM_NOT_FOUND');
    });

    it('update: 409 при смене названия на занятое', async () => {
      prisma.room.findUnique.mockResolvedValue({ id: 1, name: 'Everest' });
      prisma.room.findFirst.mockResolvedValue({ id: 2 });
      expect(await codeOf(service.update(1, { name: 'Elbrus' }))).toBe('ROOM_NAME_TAKEN');
    });

    it('update: заменяет список удобств', async () => {
      prisma.room.findUnique.mockResolvedValue({ id: 1, name: 'Everest' });
      prisma.room.update.mockResolvedValue(roomRow);
      await service.update(1, { amenityIds: [2, 3] });
      expect(prisma.room.update.mock.calls[0][0].data.amenities).toEqual({
        deleteMany: {},
        create: [{ amenityId: 2 }, { amenityId: 3 }],
      });
    });
  });

  describe('remove', () => {
    it('404, если комнаты нет', async () => {
      prisma.room.findUnique.mockResolvedValue(null);
      expect(await codeOf(service.remove(1))).toBe('ROOM_NOT_FOUND');
    });

    it('409, если есть будущие брони', async () => {
      prisma.room.findUnique.mockResolvedValue(roomRow);
      prisma.booking.count.mockResolvedValue(2);
      expect(await codeOf(service.remove(1))).toBe('ROOM_HAS_BOOKINGS');
      expect(prisma.room.delete).not.toHaveBeenCalled();
    });

    it('удаляет комнату и её историю, если будущих броней нет', async () => {
      prisma.room.findUnique.mockResolvedValue(roomRow);
      prisma.booking.count.mockResolvedValue(0);
      await service.remove(1);
      expect(prisma.booking.deleteMany).toHaveBeenCalledWith({ where: { roomId: 1 } });
      expect(prisma.room.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });

  describe('availability', () => {
    it('404 для несуществующей комнаты', async () => {
      prisma.room.findUnique.mockResolvedValue(null);
      expect(await codeOf(service.availability(9, { date: '2026-10-22', offset: 0 }))).toBe(
        'ROOM_NOT_FOUND',
      );
    });

    it('строит окно суток с учётом часового пояса клиента', async () => {
      prisma.room.findUnique.mockResolvedValue(roomRow);
      prisma.booking.findMany.mockResolvedValue([]);
      await service.availability(1, { date: '2026-10-22', offset: 180 });
      const where = prisma.booking.findMany.mock.calls[0][0].where;
      expect(where.endsAt.gt.toISOString()).toBe('2026-10-21T21:00:00.000Z');
      expect(where.startsAt.lt.toISOString()).toBe('2026-10-22T21:00:00.000Z');
      expect(where.status).toBe('ACTIVE');
    });
  });

  describe('прочее', () => {
    it('setPhoto сохраняет путь к файлу', async () => {
      prisma.room.findUnique.mockResolvedValue(roomRow);
      prisma.room.update.mockResolvedValue(roomRow);
      expect(await service.setPhoto(1, '/uploads/rooms/a.jpg')).toEqual({
        photoUrl: '/uploads/rooms/a.jpg',
      });
    });

    it('listAmenities возвращает список удобств', async () => {
      prisma.amenity.findMany.mockResolvedValue([{ id: 1, name: 'Проектор' }]);
      expect(await service.listAmenities()).toHaveLength(1);
    });
  });
});
