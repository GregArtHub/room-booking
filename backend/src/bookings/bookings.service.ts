import { Injectable } from '@nestjs/common';
import { BookingStatus, NotificationType, Prisma } from '@prisma/client';
import { AppException, ErrorDetail } from '../common/app-exception';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../common/prisma/prisma.service';
import { pageArgs, pageMeta, parseSort } from '../common/utils/pagination';
import { NotificationsService } from '../notifications/notifications.service';
import { bookingInclude, BookingWithRelations, toBookingDto } from './booking.mapper';
import {
  BookingsQueryDto,
  CreateBookingDto,
  MyBookingsQueryDto,
  UpdateBookingDto,
} from './dto/bookings.dto';

export const MAX_DURATION_MIN = 240;
export const SLOT_STEP_MIN = 30;

/** Проверка интервала брони: порядок, длительность, шаг 30 минут, не в прошлом. */
export function validateInterval(startsAt: Date, endsAt: Date, now: Date = new Date()): void {
  const errors: ErrorDetail[] = [];
  const isSlotAligned = (d: Date) =>
    d.getUTCMinutes() % SLOT_STEP_MIN === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0;

  if (Number.isNaN(startsAt.getTime()))
    errors.push({ field: 'startsAt', message: 'Некорректное время начала' });
  if (Number.isNaN(endsAt.getTime()))
    errors.push({ field: 'endsAt', message: 'Некорректное время окончания' });

  if (errors.length === 0) {
    if (startsAt < now) errors.push({ field: 'startsAt', message: 'Нельзя бронировать в прошлом' });
    if (endsAt <= startsAt) {
      errors.push({ field: 'endsAt', message: 'Окончание должно быть позже начала' });
    } else if ((endsAt.getTime() - startsAt.getTime()) / 60_000 > MAX_DURATION_MIN) {
      errors.push({ field: 'endsAt', message: 'Максимальная длительность брони — 4 часа' });
    }
    if (!isSlotAligned(startsAt))
      errors.push({ field: 'startsAt', message: 'Время должно быть кратно 30 минутам' });
    if (!isSlotAligned(endsAt))
      errors.push({ field: 'endsAt', message: 'Время должно быть кратно 30 минутам' });
  }

  if (errors.length > 0) {
    throw new AppException(400, 'VALIDATION_ERROR', 'Некорректный интервал бронирования', errors);
  }
}

function isOverlapDbError(e: unknown): boolean {
  const message = String((e as Error)?.message ?? '');
  return message.includes('bookings_no_overlap') || message.includes('23P01');
}

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(user: AuthUser, dto: CreateBookingDto) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    validateInterval(startsAt, endsAt);
    await this.assertRoomBookable(dto.roomId);
    await this.assertNoOverlap(dto.roomId, startsAt, endsAt);

    let booking: BookingWithRelations;
    try {
      booking = await this.prisma.booking.create({
        data: { roomId: dto.roomId, userId: user.id, title: dto.title.trim(), startsAt, endsAt },
        include: bookingInclude,
      });
    } catch (e) {
      // защита от гонки: ограничение EXCLUDE в PostgreSQL
      if (isOverlapDbError(e)) throw this.overlap();
      throw e;
    }
    await this.notifications.notifyBooking(NotificationType.BOOKING_CREATED, booking, user.id);
    return toBookingDto(booking);
  }

  async update(user: AuthUser, id: number, dto: UpdateBookingDto) {
    const booking = await this.findAccessible(user, id);
    if (booking.status === BookingStatus.CANCELLED) {
      throw new AppException(409, 'BOOKING_CANCELLED', 'Отменённое бронирование нельзя изменить');
    }
    const now = new Date();
    if (booking.startsAt <= now) {
      throw new AppException(
        409,
        'BOOKING_STARTED',
        'Нельзя изменить начавшееся или прошедшее бронирование',
      );
    }

    const roomId = dto.roomId ?? booking.roomId;
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : booking.startsAt;
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : booking.endsAt;
    validateInterval(startsAt, endsAt, now);
    if (roomId !== booking.roomId) await this.assertRoomBookable(roomId);
    await this.assertNoOverlap(roomId, startsAt, endsAt, id);

    let updated: BookingWithRelations;
    try {
      updated = await this.prisma.booking.update({
        where: { id },
        data: { roomId, startsAt, endsAt, ...(dto.title && { title: dto.title.trim() }) },
        include: bookingInclude,
      });
    } catch (e) {
      if (isOverlapDbError(e)) throw this.overlap();
      throw e;
    }
    await this.notifications.notifyBooking(NotificationType.BOOKING_UPDATED, updated, user.id);
    return toBookingDto(updated);
  }

  async cancel(user: AuthUser, id: number): Promise<void> {
    const booking = await this.findAccessible(user, id);
    if (booking.status === BookingStatus.CANCELLED) return;
    if (booking.endsAt <= new Date()) {
      throw new AppException(409, 'BOOKING_FINISHED', 'Прошедшее бронирование нельзя отменить');
    }
    const cancelled = await this.prisma.booking.update({
      where: { id },
      data: { status: BookingStatus.CANCELLED },
      include: bookingInclude,
    });
    await this.notifications.notifyBooking(NotificationType.BOOKING_CANCELLED, cancelled, user.id);
  }

  async listMy(user: AuthUser, q: MyBookingsQueryDto) {
    const where: Prisma.BookingWhereInput = {
      userId: user.id,
      ...(q.status && { status: q.status }),
    };
    return this.page(where, q, ['startsAt'], '-startsAt');
  }

  async listAll(q: BookingsQueryDto) {
    const where: Prisma.BookingWhereInput = {
      ...(q.status && { status: q.status }),
      ...(q.roomId && { roomId: q.roomId }),
      ...(q.userId && { userId: q.userId }),
      ...((q.from || q.to) && {
        startsAt: {
          ...(q.from && { gte: new Date(q.from) }),
          ...(q.to && { lt: new Date(q.to) }),
        },
      }),
    };
    return this.page(where, q, ['startsAt', 'createdAt'], '-startsAt');
  }

  private async page(
    where: Prisma.BookingWhereInput,
    q: MyBookingsQueryDto,
    sortable: string[],
    fallback: string,
  ) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        include: bookingInclude,
        orderBy: parseSort(q.sort, sortable, fallback),
        ...pageArgs(q.page, q.limit),
      }),
      this.prisma.booking.count({ where }),
    ]);
    return { data: items.map(toBookingDto), meta: pageMeta(q.page, q.limit, total) };
  }

  /** Бронирование доступно владельцу и администратору; иначе 403 (проверка на сервере). */
  private async findAccessible(user: AuthUser, id: number) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: bookingInclude,
    });
    if (!booking) throw new AppException(404, 'BOOKING_NOT_FOUND', 'Бронирование не найдено');
    if (booking.userId !== user.id && !user.roles.includes('admin')) {
      throw new AppException(403, 'FORBIDDEN', 'Нет доступа к чужому бронированию');
    }
    return booking;
  }

  private async assertRoomBookable(roomId: number) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new AppException(404, 'ROOM_NOT_FOUND', 'Комната не найдена');
    if (!room.isActive)
      throw new AppException(409, 'ROOM_INACTIVE', 'Комната недоступна для бронирования');
  }

  private async assertNoOverlap(roomId: number, startsAt: Date, endsAt: Date, exceptId?: number) {
    const conflict = await this.prisma.booking.findFirst({
      where: {
        roomId,
        status: BookingStatus.ACTIVE,
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
        ...(exceptId !== undefined && { id: { not: exceptId } }),
      },
      select: { id: true },
    });
    if (conflict) throw this.overlap();
  }

  private overlap() {
    return new AppException(409, 'BOOKING_OVERLAP', 'Комната уже занята на выбранное время');
  }
}
