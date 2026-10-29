import { createHash, randomBytes } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AppException } from '../common/app-exception';
import { PrismaService } from '../common/prisma/prisma.service';
import { env } from '../config/env';
import { toUserDto, userInclude, UserWithRoles } from '../users/user.mapper';
import { ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto } from './dto/auth.dto';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw this.emailTaken();

    const role = await this.prisma.role.findUnique({ where: { name: 'employee' } });
    if (!role)
      throw new AppException(500, 'ROLE_MISSING', 'Роль employee не найдена, выполните seed');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          passwordHash,
          fullName: dto.fullName.trim(),
          roles: { create: { roleId: role.id } },
        },
        include: userInclude,
      });
      return toUserDto(user);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw this.emailTaken();
      }
      throw e;
    }
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: userInclude,
    });
    const valid = user && (await bcrypt.compare(dto.password, user.passwordHash));
    if (!user || !valid) {
      throw new AppException(401, 'INVALID_CREDENTIALS', 'Неверный email или пароль');
    }
    if (user.isBlocked) throw new AppException(403, 'USER_BLOCKED', 'Аккаунт заблокирован');
    return this.issueTokens(user);
  }

  async refresh(refreshToken: string) {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(refreshToken) },
      include: { user: { include: userInclude } },
    });
    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new AppException(401, 'INVALID_REFRESH_TOKEN', 'Недействительный refresh-токен');
    }
    if (record.user.isBlocked) throw new AppException(403, 'USER_BLOCKED', 'Аккаунт заблокирован');

    // ротация: старый токен отзывается, выдаётся новая пара
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(record.user);
  }

  async logout(userId: number, refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(refreshToken), userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) return; // ответ одинаков для любого email, чтобы не раскрывать список пользователей

    const token = randomBytes(32).toString('hex');
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });
    // Вместо отправки письма ссылка выводится в лог (допускается заданием)
    this.logger.log(
      `Ссылка восстановления для ${user.email}: ${env.frontendUrl}/reset-password?token=${token}`,
    );
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: sha256(dto.token) },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new AppException(
        400,
        'INVALID_RESET_TOKEN',
        'Ссылка восстановления недействительна или устарела',
      );
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  private async issueTokens(user: UserWithRoles) {
    const roles = user.roles.map((r) => r.role.name);
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, roles },
      { secret: env.jwtAccessSecret, expiresIn: env.accessTtl },
    );
    const refreshToken = randomBytes(48).toString('hex');
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + env.refreshTtlDays * 86_400_000),
      },
    });
    return { accessToken, refreshToken };
  }

  private emailTaken() {
    return new AppException(409, 'EMAIL_TAKEN', 'Пользователь с таким email уже существует');
  }
}
