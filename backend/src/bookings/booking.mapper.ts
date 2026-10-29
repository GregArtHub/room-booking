import { Prisma } from '@prisma/client';
import { roomInclude, toRoomDto } from '../rooms/room.mapper';

export const bookingInclude = {
  room: { include: roomInclude },
  user: { select: { id: true, fullName: true } },
} satisfies Prisma.BookingInclude;

export type BookingWithRelations = Prisma.BookingGetPayload<{ include: typeof bookingInclude }>;

export function toBookingDto(b: BookingWithRelations) {
  return {
    id: b.id,
    title: b.title,
    startsAt: b.startsAt,
    endsAt: b.endsAt,
    status: b.status,
    room: toRoomDto(b.room),
    user: b.user,
    createdAt: b.createdAt,
  };
}
