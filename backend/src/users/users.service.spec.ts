import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { AppException } from '../common/app-exception';
import { PrismaService } from '../common/prisma/prisma.service';
import { UsersService } from './users.service';

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
    id: 2,
    email: 'e@example.com',
    passwordHash: bcrypt.hashSync('OldPassword1!', 4),
    fullName: 'Employee',
    avatarUrl: null,
    isBlocked: false,
    locale: 'ru',
    theme: 'system',
    createdAt: new Date(),
    roles: [{ role: { name: 'employee' } }],
    ...overrides,
  };
}

describe('UsersService', () => {
  let service: UsersService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn(), count: jest.fn() },
      role: { findUnique: jest.fn() },
      userRole: { deleteMany: jest.fn(), create: jest.fn() },
      refreshToken: { updateMany: jest.fn() },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(UsersService);
  });

  it('getMe не возвращает хэш пароля', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser());
    const me = await service.getMe(2);
    expect(me).not.toHaveProperty('passwordHash');
    expect(me.roles).toEqual(['employee']);
  });

  it('getMe: 404, если пользователя нет', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    expect(await codeOf(service.getMe(2))).toBe('USER_NOT_FOUND');
  });

  it('updateMe меняет только переданные поля (язык и тема)', async () => {
    prisma.user.update.mockResolvedValue(makeUser({ locale: 'en', theme: 'dark' }));
    const result = await service.updateMe(2, { locale: 'en' as any, theme: 'dark' as any });
    expect(prisma.user.update.mock.calls[0][0].data).toEqual({ locale: 'en', theme: 'dark' });
    expect(result.theme).toBe('dark');
  });

  describe('changePassword', () => {
    it('отклоняет неверный текущий пароль', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser());
      expect(
        await codeOf(
          service.changePassword(2, { currentPassword: 'wrong', newPassword: 'NewPassword1!' }),
        ),
      ).toBe('WRONG_PASSWORD');
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('сохраняет новый пароль в виде хэша', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser());
      prisma.user.update.mockResolvedValue({});
      await service.changePassword(2, {
        currentPassword: 'OldPassword1!',
        newPassword: 'NewPassword1!',
      });
      const hash = prisma.user.update.mock.calls[0][0].data.passwordHash as string;
      expect(await bcrypt.compare('NewPassword1!', hash)).toBe(true);
    });
  });

  describe('list', () => {
    it('строит фильтры по поиску, роли и блокировке', async () => {
      prisma.user.findMany.mockResolvedValue([makeUser()]);
      prisma.user.count.mockResolvedValue(1);
      const result = await service.list({
        page: 1,
        limit: 10,
        search: 'ivan',
        role: 'admin',
        blocked: false,
      } as any);
      const where = prisma.user.findMany.mock.calls[0][0].where;
      expect(where.OR).toHaveLength(2);
      expect(where.roles).toEqual({ some: { role: { name: 'admin' } } });
      expect(where.isBlocked).toBe(false);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('setBlocked', () => {
    it('нельзя заблокировать самого себя', async () => {
      expect(await codeOf(service.setBlocked(1, 1, { blocked: true }))).toBe('CANNOT_BLOCK_SELF');
    });

    it('блокировка отзывает refresh-токены', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser());
      prisma.user.update.mockResolvedValue(makeUser({ isBlocked: true }));
      const result = await service.setBlocked(1, 2, { blocked: true });
      expect(result.isBlocked).toBe(true);
      expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
    });

    it('разблокировка не трогает токены', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser({ isBlocked: true }));
      prisma.user.update.mockResolvedValue(makeUser());
      await service.setBlocked(1, 2, { blocked: false });
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('setRole', () => {
    it('администратор не может снять с себя роль admin', async () => {
      expect(await codeOf(service.setRole(1, 1, { role: 'employee' }))).toBe(
        'CANNOT_CHANGE_OWN_ROLE',
      );
    });

    it('назначает новую роль', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(makeUser())
        .mockResolvedValueOnce(makeUser({ roles: [{ role: { name: 'admin' } }] }));
      prisma.role.findUnique.mockResolvedValue({ id: 3, name: 'admin' });
      const result = await service.setRole(1, 2, { role: 'admin' });
      expect(prisma.userRole.deleteMany).toHaveBeenCalledWith({ where: { userId: 2 } });
      expect(prisma.userRole.create).toHaveBeenCalledWith({ data: { userId: 2, roleId: 3 } });
      expect(result.roles).toEqual(['admin']);
    });

    it('404, если роль не найдена', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser());
      prisma.role.findUnique.mockResolvedValue(null);
      expect(await codeOf(service.setRole(1, 2, { role: 'admin' }))).toBe('ROLE_NOT_FOUND');
    });
  });
});
