import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { AppException } from '../common/app-exception';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthService } from './auth.service';

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return 'OK';
  } catch (e) {
    return e instanceof AppException ? e.code : `ERR:${String(e)}`;
  }
}

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    email: 'ivan@example.com',
    passwordHash: bcrypt.hashSync('Password1!', 4),
    fullName: 'Ivan',
    avatarUrl: null,
    isBlocked: false,
    locale: 'ru',
    theme: 'system',
    createdAt: new Date(),
    roles: [{ role: { name: 'employee' } }],
    ...overrides,
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let jwt: { signAsync: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      role: { findUnique: jest.fn() },
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      passwordResetToken: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    jwt = { signAsync: jest.fn().mockResolvedValue('access.token') };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  describe('register', () => {
    const dto = { email: 'ivan@example.com', password: 'Password1!', fullName: 'Ivan' };

    it('возвращает 409, если email занят', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser());
      expect(await codeOf(service.register(dto))).toBe('EMAIL_TAKEN');
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('хранит пароль только в виде хэша и не возвращает его', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.role.findUnique.mockResolvedValue({ id: 2, name: 'employee' });
      prisma.user.create.mockImplementation(async ({ data }: any) =>
        makeUser({ email: data.email, passwordHash: data.passwordHash }),
      );

      const result = await service.register(dto);

      const savedHash = prisma.user.create.mock.calls[0][0].data.passwordHash as string;
      expect(savedHash).not.toBe(dto.password);
      expect(await bcrypt.compare(dto.password, savedHash)).toBe(true);
      expect(result).not.toHaveProperty('passwordHash');
      expect(result.roles).toEqual(['employee']);
    });
  });

  describe('login', () => {
    it('отклоняет неверный пароль (401)', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser());
      expect(await codeOf(service.login({ email: 'ivan@example.com', password: 'wrong' }))).toBe(
        'INVALID_CREDENTIALS',
      );
    });

    it('отклоняет неизвестный email одинаковой ошибкой', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      expect(await codeOf(service.login({ email: 'no@example.com', password: 'x' }))).toBe(
        'INVALID_CREDENTIALS',
      );
    });

    it('не пускает заблокированного пользователя (403)', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser({ isBlocked: true }));
      expect(
        await codeOf(service.login({ email: 'ivan@example.com', password: 'Password1!' })),
      ).toBe('USER_BLOCKED');
    });

    it('выдаёт пару токенов и хранит только хэш refresh-токена', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser());
      prisma.refreshToken.create.mockResolvedValue({});

      const tokens = await service.login({ email: 'ivan@example.com', password: 'Password1!' });

      expect(tokens.accessToken).toBe('access.token');
      expect(tokens.refreshToken).toHaveLength(96);
      const stored = prisma.refreshToken.create.mock.calls[0][0].data;
      expect(stored.tokenHash).not.toBe(tokens.refreshToken);
      expect(stored.userId).toBe(1);
    });
  });

  describe('refresh', () => {
    it('отклоняет неизвестный токен', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);
      expect(await codeOf(service.refresh('abc'))).toBe('INVALID_REFRESH_TOKEN');
    });

    it('отклоняет отозванный и просроченный токены', async () => {
      const base = { id: 5, user: makeUser() };
      prisma.refreshToken.findUnique.mockResolvedValueOnce({
        ...base,
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 1e6),
      });
      expect(await codeOf(service.refresh('abc'))).toBe('INVALID_REFRESH_TOKEN');
      prisma.refreshToken.findUnique.mockResolvedValueOnce({
        ...base,
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      });
      expect(await codeOf(service.refresh('abc'))).toBe('INVALID_REFRESH_TOKEN');
    });

    it('ротирует токен: старый отзывается, выдаётся новая пара', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 5,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 1e6),
        user: makeUser(),
      });
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      const tokens = await service.refresh('old');

      expect(prisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 5 }, data: { revokedAt: expect.any(Date) } }),
      );
      expect(tokens.accessToken).toBe('access.token');
    });
  });

  describe('восстановление пароля', () => {
    it('для неизвестного email ничего не создаёт и не падает', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.forgotPassword({ email: 'no@example.com' })).resolves.toBeUndefined();
      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    });

    it('для известного email создаёт одноразовый токен', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser());
      prisma.passwordResetToken.create.mockResolvedValue({});
      await service.forgotPassword({ email: 'ivan@example.com' });
      const data = prisma.passwordResetToken.create.mock.calls[0][0].data;
      expect(data.userId).toBe(1);
      expect(data.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('сброс по неверному токену даёт 400', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(null);
      expect(
        await codeOf(service.resetPassword({ token: 't', newPassword: 'NewPassword1!' })),
      ).toBe('INVALID_RESET_TOKEN');
    });

    it('сброс по верному токену меняет пароль и отзывает сессии', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 3,
        userId: 1,
        usedAt: null,
        expiresAt: new Date(Date.now() + 1e6),
      });
      await service.resetPassword({ token: 't', newPassword: 'NewPassword1!' });
      expect(prisma.user.update).toHaveBeenCalled();
      expect(prisma.passwordResetToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { usedAt: expect.any(Date) } }),
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('отзывает refresh-токен пользователя', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
      await service.logout(1, 'token');
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ userId: 1, revokedAt: null }) }),
      );
    });
  });
});
