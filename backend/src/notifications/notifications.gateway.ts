import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { env } from '../config/env';

/**
 * WebSocket-шлюз (Socket.IO). Клиент подключается с { auth: { token } },
 * сервер проверяет JWT и добавляет сокет в комнату user:<id>.
 */
@Injectable()
@WebSocketGateway({ cors: { origin: env.frontendUrl, credentials: true } })
export class NotificationsGateway implements OnGatewayConnection {
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(private readonly jwt: JwtService) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) throw new Error('no token');
      const payload = await this.jwt.verifyAsync<{ sub: number }>(token, {
        secret: env.jwtAccessSecret,
      });
      await client.join(`user:${payload.sub}`);
    } catch {
      this.logger.debug('WebSocket: соединение отклонено (нет или неверный токен)');
      client.disconnect(true);
    }
  }

  emitToUser(userId: number, payload: unknown): void {
    this.server?.to(`user:${userId}`).emit('notification', payload);
  }
}
