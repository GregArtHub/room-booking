import { Injectable } from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { AppException } from '../common/app-exception';
import { PrismaService } from '../common/prisma/prisma.service';
import { pageArgs, pageMeta, parseSort } from '../common/utils/pagination';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { AvailabilityQueryDto, CreateRoomDto, RoomsQueryDto, UpdateRoomDto } from './dto/rooms.dto';
import { roomInclude, toRoomDto } from './room.mapper';

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: RoomsQueryDto, user: AuthUser | null) {
    const isAdmin = !!user?.roles.includes('admin');
    const and: Prisma.RoomWhereInput[] = [];
    if (!(q.includeInactive && isAdmin)) and.push({ isActive: true });
    if (q.search) {
      and.push({
        OR: [
          { name: { contains: q.search, mode: 'insensitive' } },
          { description: { contains: q.search, mode: 'insensitive' } },
        ],
      });
    }
    if (q.minCapacity) and.push({ capacity: { gte: q.minCapacity } });
    if (q.floor !== undefined) and.push({ floor: q.floor });
    for (const id of parseIds(q.amenities)) and.push({ amenities: { some: { amenityId: id } } });

    const where: Prisma.RoomWhereInput = { AND: and };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.room.findMany({
        where,
        include: roomInclude,
        orderBy: parseSort(q.sort, ['name', 'capacity', 'floor'], 'name'),
        ...pageArgs(q.page, q.limit),
      }),
      this.prisma.room.count({ where }),
    ]);
    return { data: items.map(toRoomDto), meta: pageMeta(q.page, q.limit, total) };
  }

  async get(id: number) {
    const room = await this.prisma.room.findUnique({ where: { id }, include: roomInclude });
    if (!room) throw this.notFound();
    return toRoomDto(room);
  }

  async create(dto: CreateRoomDto) {
    await this.assertNameFree(dto.name);
    try {
      const room = await this.prisma.room.create({
        data: {
          name: dto.name.trim(),
          description: dto.description,
          capacity: dto.capacity,
          floor: dto.floor,
          isActive: dto.isActive ?? true,
          amenities: { create: (dto.amenityIds ?? []).map((amenityId) => ({ amenityId })) },
        },
        include: roomInclude,
      });
      return toRoomDto(room);
    } catch (e) {
      throw this.mapPrismaError(e);
    }
  }

  async update(id: number, dto: UpdateRoomDto) {
    const existing = await this.prisma.room.findUnique({ where: { id } });
    if (!existing) throw this.notFound();
    if (dto.name && dto.name !== existing.name) await this.assertNameFree(dto.name, id);
    try {
      const room = await this.prisma.room.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name.trim() }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.capacity !== undefined && { capacity: dto.capacity }),
          ...(dto.floor !== undefined && { floor: dto.floor }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          ...(dto.amenityIds && {
            amenities: {
              deleteMany: {},
              create: dto.amenityIds.map((amenityId) => ({ amenityId })),
            },
          }),
        },
        include: roomInclude,
      });
      return toRoomDto(room);
    } catch (e) {
      throw this.mapPrismaError(e);
    }
  }

  async remove(id: number): Promise<void> {
    const room = await this.prisma.room.findUnique({ where: { id } });
    if (!room) throw this.notFound();

    const future = await this.prisma.booking.count({
      where: { roomId: id, status: BookingStatus.ACTIVE, endsAt: { gt: new Date() } },
    });
    if (future > 0) {
      throw new AppException(
        409,
        'ROOM_HAS_BOOKINGS',
        'Нельзя удалить комнату с будущими бронированиями. Деактивируйте её или отмените брони.',
      );
    }
    await this.prisma.$transaction([
      this.prisma.booking.deleteMany({ where: { roomId: id } }),
      this.prisma.room.delete({ where: { id } }),
    ]);
  }

  async setPhoto(id: number, photoUrl: string) {
    const room = await this.prisma.room.findUnique({ where: { id } });
    if (!room) throw this.notFound();
    await this.prisma.room.update({ where: { id }, data: { photoUrl } });
    return { photoUrl };
  }

  /** Занятые интервалы комнаты на выбранную календарную дату клиента. */
  async availability(id: number, q: AvailabilityQueryDto) {
    const room = await this.prisma.room.findUnique({ where: { id } });
    if (!room) throw this.notFound();

    const [y, m, d] = q.date.split('-').map(Number);
    const start = new Date(Date.UTC(y, m - 1, d) - q.offset * 60_000);
    if (Number.isNaN(start.getTime())) {
      throw new AppException(400, 'VALIDATION_ERROR', 'Некорректная дата', [
        { field: 'date', message: 'Некорректная дата' },
      ]);
    }
    const end = new Date(start.getTime() + 86_400_000);

    return this.prisma.booking.findMany({
      where: {
        roomId: id,
        status: BookingStatus.ACTIVE,
        startsAt: { lt: end },
        endsAt: { gt: start },
      },
      orderBy: { startsAt: 'asc' },
      select: { id: true, startsAt: true, endsAt: true },
    });
  }

  async listAmenities() {
    return this.prisma.amenity.findMany({ orderBy: { name: 'asc' } });
  }

  private async assertNameFree(name: string, exceptId?: number) {
    const clash = await this.prisma.room.findFirst({
      where: { name: name.trim(), ...(exceptId && { id: { not: exceptId } }) },
      select: { id: true },
    });
    if (clash)
      throw new AppException(409, 'ROOM_NAME_TAKEN', 'Комната с таким названием уже существует');
  }

  private mapPrismaError(e: unknown): unknown {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2002') {
        return new AppException(409, 'ROOM_NAME_TAKEN', 'Комната с таким названием уже существует');
      }
      if (e.code === 'P2003') {
        return new AppException(400, 'INVALID_AMENITY', 'Указано несуществующее удобство');
      }
    }
    return e;
  }

  private notFound() {
    return new AppException(404, 'ROOM_NOT_FOUND', 'Комната не найдена');
  }
}

function parseIds(value?: string): number[] {
  if (!value) return [];
  return value
    .split(',')
    .map((v) => Number(v.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
}
