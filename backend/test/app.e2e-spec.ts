/**
 * Интеграционные тесты API на реальной тестовой БД PostgreSQL.
 * Требуется DATABASE_URL и применённые миграции (npx prisma migrate deploy).
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('Room Booking API (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let employeeToken: string;
  let otherToken: string;
  let roomId: number;

  const http = () => request(app.getHttpServer());
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function login(email: string, password: string): Promise<string> {
    const res = await http().post('/api/auth/login').send({ email, password }).expect(200);
    return res.body.data.accessToken as string;
  }

  /** Слот завтра в заданный час UTC (кратно 30 минутам). */
  function tomorrowAt(hour: number, minute = 0): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 1);
    d.setUTCHours(hour, minute, 0, 0);
    return d.toISOString();
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "notifications","refresh_tokens","password_reset_tokens","bookings",' +
        '"room_amenities","rooms","amenities","user_roles","users","roles" RESTART IDENTITY CASCADE',
    );
    const adminRole = await prisma.role.create({ data: { name: 'admin' } });
    await prisma.role.create({ data: { name: 'employee' } });
    await prisma.role.create({ data: { name: 'guest' } });
    await prisma.user.create({
      data: {
        email: 'admin@test.com',
        fullName: 'Admin',
        passwordHash: await bcrypt.hash('Admin123!', 4),
        roles: { create: { roleId: adminRole.id } },
      },
    });

    await http()
      .post('/api/auth/register')
      .send({ email: 'emp@test.com', password: 'Employee123!', fullName: 'Employee' })
      .expect(201);
    await http()
      .post('/api/auth/register')
      .send({ email: 'other@test.com', password: 'Employee123!', fullName: 'Other' })
      .expect(201);

    adminToken = await login('admin@test.com', 'Admin123!');
    employeeToken = await login('emp@test.com', 'Employee123!');
    otherToken = await login('other@test.com', 'Employee123!');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('аутентификация', () => {
    it('регистрация: повторный email даёт 409 в едином формате ошибки', async () => {
      const res = await http()
        .post('/api/auth/register')
        .send({ email: 'emp@test.com', password: 'Employee123!', fullName: 'Employee' })
        .expect(409);
      expect(res.body.error.code).toBe('EMAIL_TAKEN');
    });

    it('регистрация: невалидные данные дают 400 с деталями по полям', async () => {
      const res = await http()
        .post('/api/auth/register')
        .send({ email: 'not-an-email', password: '123', fullName: 'A' })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.map((d: any) => d.field)).toEqual(
        expect.arrayContaining(['email', 'password', 'fullName']),
      );
    });

    it('вход: неверный пароль даёт 401, верный выдаёт токены, refresh ротирует токен', async () => {
      await http()
        .post('/api/auth/login')
        .send({ email: 'emp@test.com', password: 'bad' })
        .expect(401);
      const ok = await http()
        .post('/api/auth/login')
        .send({ email: 'emp@test.com', password: 'Employee123!' })
        .expect(200);
      expect(ok.body.data.accessToken).toBeDefined();

      const refreshToken = ok.body.data.refreshToken as string;
      const refreshed = await http().post('/api/auth/refresh').send({ refreshToken }).expect(200);
      expect(refreshed.body.data.refreshToken).not.toBe(refreshToken);
      // старый refresh-токен больше недействителен
      await http().post('/api/auth/refresh').send({ refreshToken }).expect(401);
    });

    it('защищённый маршрут без токена даёт 401', async () => {
      await http().get('/api/bookings/my').expect(401);
    });
  });

  describe('роли и права (RBAC)', () => {
    it('сотрудник не может получить список пользователей (403), администратор может', async () => {
      await http().get('/api/users').set(auth(employeeToken)).expect(403);
      const res = await http().get('/api/users').set(auth(adminToken)).expect(200);
      expect(res.body.meta.total).toBe(3);
      expect(res.body.data[0]).not.toHaveProperty('passwordHash');
    });

    it('сотрудник не может создать комнату (403)', async () => {
      await http()
        .post('/api/rooms')
        .set(auth(employeeToken))
        .send({ name: 'Hack room', capacity: 4, floor: 1 })
        .expect(403);
    });
  });

  describe('комнаты: список, поиск, пагинация', () => {
    it('администратор создаёт комнаты, гость видит список с поиском и пагинацией', async () => {
      const created = await http()
        .post('/api/rooms')
        .set(auth(adminToken))
        .send({ name: 'Everest', description: 'Big room', capacity: 12, floor: 3 })
        .expect(201);
      roomId = created.body.data.id;
      await http()
        .post('/api/rooms')
        .set(auth(adminToken))
        .send({ name: 'Elbrus', capacity: 6, floor: 2 })
        .expect(201);
      await http()
        .post('/api/rooms')
        .set(auth(adminToken))
        .send({ name: 'Fuji', capacity: 4, floor: 2 })
        .expect(201);
      await http()
        .post('/api/rooms')
        .set(auth(adminToken))
        .send({ name: 'Everest', capacity: 4, floor: 1 })
        .expect(409);

      const page = await http().get('/api/rooms?limit=2&page=1&sort=-capacity').expect(200);
      expect(page.body.meta).toEqual({ page: 1, limit: 2, total: 3 });
      expect(page.body.data.map((r: any) => r.name)).toEqual(['Everest', 'Elbrus']);

      const search = await http().get('/api/rooms?search=elb').expect(200);
      expect(search.body.data).toHaveLength(1);
      const big = await http().get('/api/rooms?minCapacity=10').expect(200);
      expect(big.body.data.map((r: any) => r.name)).toEqual(['Everest']);
    });
  });

  describe('бронирования', () => {
    let bookingId: number;

    it('создаёт бронь, а пересекающаяся бронь получает 409 BOOKING_OVERLAP', async () => {
      const first = await http()
        .post('/api/bookings')
        .set(auth(employeeToken))
        .send({ roomId, title: 'Planning', startsAt: tomorrowAt(10), endsAt: tomorrowAt(11, 30) })
        .expect(201);
      bookingId = first.body.data.id;

      const overlap = await http()
        .post('/api/bookings')
        .set(auth(otherToken))
        .send({ roomId, title: 'Clash', startsAt: tomorrowAt(11), endsAt: tomorrowAt(12) })
        .expect(409);
      expect(overlap.body.error.code).toBe('BOOKING_OVERLAP');

      // встык (начало = конец предыдущей) — разрешено
      await http()
        .post('/api/bookings')
        .set(auth(otherToken))
        .send({
          roomId,
          title: 'Back to back',
          startsAt: tomorrowAt(11, 30),
          endsAt: tomorrowAt(12, 30),
        })
        .expect(201);
    });

    it('валидация: интервал не кратный 30 минутам отклоняется', async () => {
      const res = await http()
        .post('/api/bookings')
        .set(auth(employeeToken))
        .send({ roomId, title: 'Odd time', startsAt: tomorrowAt(14, 15), endsAt: tomorrowAt(15) })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('availability показывает занятые слоты', async () => {
      const date = tomorrowAt(0).slice(0, 10);
      const res = await http().get(`/api/rooms/${roomId}/availability?date=${date}`).expect(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('сотрудник не видит и не отменяет чужие брони, видит только свои', async () => {
      const mine = await http().get('/api/bookings/my').set(auth(otherToken)).expect(200);
      expect(mine.body.meta.total).toBe(1);
      expect(mine.body.data[0].user.fullName).toBe('Other');

      await http().delete(`/api/bookings/${bookingId}`).set(auth(otherToken)).expect(403);
      await http()
        .patch(`/api/bookings/${bookingId}`)
        .set(auth(otherToken))
        .send({ title: 'Hijack' })
        .expect(403);
    });

    it('владелец отменяет бронь, и слот освобождается', async () => {
      await http().delete(`/api/bookings/${bookingId}`).set(auth(employeeToken)).expect(204);
      await http()
        .post('/api/bookings')
        .set(auth(otherToken))
        .send({ roomId, title: 'Now free', startsAt: tomorrowAt(10), endsAt: tomorrowAt(11) })
        .expect(201);
    });

    it('администратор получил уведомления о действиях сотрудников', async () => {
      const res = await http().get('/api/notifications').set(auth(adminToken)).expect(200);
      expect(res.body.meta.total).toBeGreaterThanOrEqual(3);
      const first = res.body.data[0];
      await http().patch(`/api/notifications/${first.id}/read`).set(auth(adminToken)).expect(200);
      await http()
        .patch(`/api/notifications/${first.id}/read`)
        .set(auth(employeeToken))
        .expect(404);
    });
  });

  describe('дашборд и блокировка', () => {
    it('дашборд доступен администратору и недоступен сотруднику', async () => {
      const from = tomorrowAt(0).slice(0, 10);
      const res = await http()
        .get(`/api/stats/dashboard?from=${from}&to=${from}`)
        .set(auth(adminToken))
        .expect(200);
      expect(res.body.data.totalBookings).toBeGreaterThan(0);
      await http()
        .get(`/api/stats/dashboard?from=${from}&to=${from}`)
        .set(auth(employeeToken))
        .expect(403);
    });

    it('заблокированный пользователь не может войти и теряет доступ', async () => {
      const users = await http().get('/api/users?search=other').set(auth(adminToken)).expect(200);
      const id = users.body.data[0].id as number;
      await http()
        .patch(`/api/users/${id}/block`)
        .set(auth(adminToken))
        .send({ blocked: true })
        .expect(200);

      await http().get('/api/bookings/my').set(auth(otherToken)).expect(401);
      await http()
        .post('/api/auth/login')
        .send({ email: 'other@test.com', password: 'Employee123!' })
        .expect(403);
    });
  });
});
