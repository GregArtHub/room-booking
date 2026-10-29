import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AppException } from '../common/app-exception';
import { PrismaService } from '../common/prisma/prisma.service';
import { pageArgs, pageMeta, parseSort } from '../common/utils/pagination';
import {
  ChangePasswordDto,
  SetBlockedDto,
  SetRoleDto,
  UpdateProfileDto,
  UsersQueryDto,
} from './dto/users.dto';
import { toUserDto, userInclude } from './user.mapper';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: number) {
    return toUserDto(await this.findOrFail(userId));
  }

  async updateMe(userId: number, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.fullName !== undefined && { fullName: dto.fullName.trim() }),
        ...(dto.locale && { locale: dto.locale }),
        ...(dto.theme && { theme: dto.theme }),
      },
      include: userInclude,
    });
    return toUserDto(user);
  }

  async setAvatar(userId: number, avatarUrl: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      include: userInclude,
    });
    return { avatarUrl: user.avatarUrl };
  }

  async changePassword(userId: number, dto: ChangePasswordDto): Promise<void> {
    const user = await this.findOrFail(userId);
    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) {
      throw new AppException(400, 'WRONG_PASSWORD', 'Текущий пароль указан неверно', [
        { field: 'currentPassword', message: 'Текущий пароль указан неверно' },
      ]);
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  }

  async list(q: UsersQueryDto) {
    const where: Prisma.UserWhereInput = {
      ...(q.search && {
        OR: [
          { email: { contains: q.search, mode: 'insensitive' } },
          { fullName: { contains: q.search, mode: 'insensitive' } },
        ],
      }),
      ...(q.role && { roles: { some: { role: { name: q.role } } } }),
      ...(q.blocked !== undefined && { isBlocked: q.blocked }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: userInclude,
        orderBy: parseSort(q.sort, ['fullName', 'email', 'createdAt'], '-createdAt'),
        ...pageArgs(q.page, q.limit),
      }),
      this.prisma.user.count({ where }),
    ]);
    return { data: items.map(toUserDto), meta: pageMeta(q.page, q.limit, total) };
  }

  async setRole(actorId: number, id: number, dto: SetRoleDto) {
    if (id === actorId && dto.role !== 'admin') {
      throw new AppException(
        400,
        'CANNOT_CHANGE_OWN_ROLE',
        'Нельзя снять с себя роль администратора',
      );
    }
    await this.findOrFail(id);
    const role = await this.prisma.role.findUnique({ where: { name: dto.role } });
    if (!role) throw new AppException(404, 'ROLE_NOT_FOUND', 'Роль не найдена');

    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId: id } }),
      this.prisma.userRole.create({ data: { userId: id, roleId: role.id } }),
    ]);
    return toUserDto(await this.findOrFail(id));
  }

  async setBlocked(actorId: number, id: number, dto: SetBlockedDto) {
    if (id === actorId && dto.blocked) {
      throw new AppException(400, 'CANNOT_BLOCK_SELF', 'Нельзя заблокировать самого себя');
    }
    await this.findOrFail(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: { isBlocked: dto.blocked },
      include: userInclude,
    });
    if (dto.blocked) {
      // заблокированный пользователь теряет все refresh-токены
      await this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return toUserDto(user);
  }

  private async findOrFail(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id }, include: userInclude });
    if (!user) throw new AppException(404, 'USER_NOT_FOUND', 'Пользователь не найден');
    return user;
  }
}
