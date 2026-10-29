import { PrismaClient, BookingStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function at(daysFromToday: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function main() {
  // Роли
  const roles: Record<string, number> = {};
  for (const name of ['guest', 'employee', 'admin']) {
    const role = await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
    roles[name] = role.id;
  }

  // Удобства
  const amenityNames = ['Проектор', 'Маркерная доска', 'Видеосвязь (ВКС)', 'Кондиционер', 'Экран'];
  const amenities: Record<string, number> = {};
  for (const name of amenityNames) {
    const a = await prisma.amenity.upsert({ where: { name }, update: {}, create: { name } });
    amenities[name] = a.id;
  }

  // Тестовые пользователи: по одному на роль
  const users = [
    { email: 'admin@example.com', fullName: 'Анна Админова', password: 'Admin123!', role: 'admin' },
    {
      email: 'employee@example.com',
      fullName: 'Иван Сотрудников',
      password: 'Employee123!',
      role: 'employee',
    },
    {
      email: 'employee2@example.com',
      fullName: 'Мария Петрова',
      password: 'Employee123!',
      role: 'employee',
    },
  ];
  const userIds: Record<string, number> = {};
  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { email: u.email, fullName: u.fullName, passwordHash },
    });
    userIds[u.email] = user.id;
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: roles[u.role] } },
      update: {},
      create: { userId: user.id, roleId: roles[u.role] },
    });
  }

  // Комнаты
  const rooms = [
    {
      name: 'Эверест',
      capacity: 12,
      floor: 3,
      description: 'Большая переговорная для совещаний',
      amenities: ['Проектор', 'Маркерная доска', 'Видеосвязь (ВКС)', 'Кондиционер'],
    },
    {
      name: 'Эльбрус',
      capacity: 8,
      floor: 3,
      description: 'Средняя комната для командных встреч',
      amenities: ['Экран', 'Маркерная доска', 'Кондиционер'],
    },
    {
      name: 'Монблан',
      capacity: 4,
      floor: 2,
      description: 'Небольшая комната для созвонов',
      amenities: ['Экран', 'Видеосвязь (ВКС)'],
    },
    {
      name: 'Фудзи',
      capacity: 6,
      floor: 2,
      description: 'Комната для интервью и 1:1',
      amenities: ['Маркерная доска'],
    },
    {
      name: 'Казбек',
      capacity: 20,
      floor: 1,
      description: 'Зал для презентаций',
      amenities: ['Проектор', 'Видеосвязь (ВКС)', 'Кондиционер'],
    },
    {
      name: 'Арарат',
      capacity: 10,
      floor: 1,
      description: 'Комната для воркшопов',
      amenities: ['Проектор', 'Маркерная доска'],
    },
  ];
  const roomIds: number[] = [];
  for (const r of rooms) {
    const room = await prisma.room.upsert({
      where: { name: r.name },
      update: {},
      create: { name: r.name, capacity: r.capacity, floor: r.floor, description: r.description },
    });
    roomIds.push(room.id);
    for (const a of r.amenities) {
      await prisma.roomAmenity.upsert({
        where: { roomId_amenityId: { roomId: room.id, amenityId: amenities[a] } },
        update: {},
        create: { roomId: room.id, amenityId: amenities[a] },
      });
    }
  }

  // Бронирования создаём только в пустой БД, чтобы повторный запуск seed не стирал данные
  if ((await prisma.booking.count()) > 0) return;
  const e1 = userIds['employee@example.com'];
  const e2 = userIds['employee2@example.com'];
  await prisma.booking.createMany({
    data: [
      {
        roomId: roomIds[0],
        userId: e1,
        title: 'Планирование спринта',
        startsAt: at(1, 10),
        endsAt: at(1, 11, 30),
      },
      {
        roomId: roomIds[0],
        userId: e2,
        title: 'Ретроспектива',
        startsAt: at(1, 14),
        endsAt: at(1, 15),
      },
      {
        roomId: roomIds[1],
        userId: e1,
        title: 'Синк по дизайну',
        startsAt: at(2, 11),
        endsAt: at(2, 12),
      },
      {
        roomId: roomIds[2],
        userId: e2,
        title: 'Созвон с клиентом',
        startsAt: at(2, 15),
        endsAt: at(2, 16),
      },
      {
        roomId: roomIds[4],
        userId: e1,
        title: 'Демо продукта',
        startsAt: at(3, 12),
        endsAt: at(3, 14),
      },
      {
        roomId: roomIds[3],
        userId: e2,
        title: 'Собеседование',
        startsAt: at(-1, 10),
        endsAt: at(-1, 11),
      },
      {
        roomId: roomIds[1],
        userId: e1,
        title: 'Отменённая встреча',
        startsAt: at(4, 10),
        endsAt: at(4, 11),
        status: BookingStatus.CANCELLED,
      },
    ],
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
