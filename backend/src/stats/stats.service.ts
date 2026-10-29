import { Injectable } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { AppException } from '../common/app-exception';
import { PrismaService } from '../common/prisma/prisma.service';
import { DashboardQueryDto } from './dto/stats.dto';

const DAY_MS = 86_400_000;

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(q: DashboardQueryDto) {
    const start = new Date(`${q.from}T00:00:00.000Z`);
    const lastDay = new Date(`${q.to}T00:00:00.000Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(lastDay.getTime()) || lastDay < start) {
      throw new AppException(400, 'VALIDATION_ERROR', 'Некорректный период', [
        { field: 'from', message: 'Дата начала должна быть не позже даты окончания' },
      ]);
    }
    if ((lastDay.getTime() - start.getTime()) / DAY_MS > 366) {
      throw new AppException(400, 'VALIDATION_ERROR', 'Период не должен превышать 366 дней');
    }
    const end = new Date(lastDay.getTime() + DAY_MS);

    const bookings = await this.prisma.booking.findMany({
      where: { status: BookingStatus.ACTIVE, startsAt: { gte: start, lt: end } },
      include: { room: { select: { id: true, name: true } } },
    });

    const byDayMap = new Map<string, number>();
    for (let t = start.getTime(); t <= lastDay.getTime(); t += DAY_MS) {
      byDayMap.set(new Date(t).toISOString().slice(0, 10), 0);
    }
    const rooms = new Map<
      number,
      { roomId: number; name: string; bookings: number; hoursBooked: number }
    >();
    let totalMinutes = 0;

    for (const b of bookings) {
      const day = b.startsAt.toISOString().slice(0, 10);
      byDayMap.set(day, (byDayMap.get(day) ?? 0) + 1);
      const minutes = (b.endsAt.getTime() - b.startsAt.getTime()) / 60_000;
      totalMinutes += minutes;
      const r = rooms.get(b.room.id) ?? {
        roomId: b.room.id,
        name: b.room.name,
        bookings: 0,
        hoursBooked: 0,
      };
      r.bookings += 1;
      r.hoursBooked += minutes / 60;
      rooms.set(b.room.id, r);
    }

    const byRoom = [...rooms.values()]
      .map((r) => ({ ...r, hoursBooked: Math.round(r.hoursBooked * 10) / 10 }))
      .sort((a, b) => b.bookings - a.bookings);

    return {
      totalBookings: bookings.length,
      averageDurationMinutes: bookings.length ? Math.round(totalMinutes / bookings.length) : 0,
      topRoom: byRoom[0]
        ? { roomId: byRoom[0].roomId, name: byRoom[0].name, bookings: byRoom[0].bookings }
        : null,
      byDay: [...byDayMap.entries()].map(([date, count]) => ({ date, bookings: count })),
      byRoom: byRoom.map(({ roomId, name, hoursBooked }) => ({ roomId, name, hoursBooked })),
    };
  }
}
