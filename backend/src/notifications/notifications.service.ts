import { Injectable } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { AppException } from '../common/app-exception';
import { PrismaService } from '../common/prisma/prisma.service';
import { pageArgs, pageMeta } from '../common/utils/pagination';
import { NotificationsQueryDto } from './dto/notifications.dto';
import { NotificationsGateway } from './notifications.gateway';

export interface BookingForNotification {
  title: string;
  userId: number;
  room: { name: string };
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
  ) {}

  /**
   * Уведомляет владельца брони (если действие выполнил не он сам) и всех администраторов
   * (кроме инициатора), сохраняет уведомления в БД и отправляет их по WebSocket.
   */
  async notifyBooking(
    type: NotificationType,
    booking: BookingForNotification,
    actorId: number,
  ): Promise<void> {
    const admins = await this.prisma.user.findMany({
      where: { roles: { some: { role: { name: 'admin' } } }, isBlocked: false },
      select: { id: true },
    });
    const recipients = new Set<number>(admins.map((a) => a.id));
    recipients.add(booking.userId);
    recipients.delete(actorId);
    if (recipients.size === 0) return;

    const text = `${booking.room.name}: ${booking.title}`;
    const created = await this.prisma.$transaction(
      [...recipients].map((userId) =>
        this.prisma.notification.create({ data: { userId, type, text } }),
      ),
    );
    for (const n of created) this.gateway.emitToUser(n.userId, n);
  }

  async list(userId: number, q: NotificationsQueryDto) {
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(q.unread && { isRead: false }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...pageArgs(q.page, q.limit),
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { data: items, meta: pageMeta(q.page, q.limit, total) };
  }

  async markRead(userId: number, id: number) {
    const found = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!found) throw new AppException(404, 'NOTIFICATION_NOT_FOUND', 'Уведомление не найдено');
    return this.prisma.notification.update({ where: { id }, data: { isRead: true } });
  }
}
