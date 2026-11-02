# RoomBook — платформа бронирования переговорных

Fullstack MVP: сотрудники бронируют переговорные комнаты в календаре слотов, система не допускает пересечений,
администратор управляет комнатами и пользователями и видит статистику загрузки.

**Публичная ссылка на развёрнутое приложение (временный стенд):** https://for-choose-storm-cheapest.trycloudflare.com

> Стенд запущен на компьютере разработчика через Cloudflare Tunnel (см. раздел «Деплой»). Адрес меняется при каждом
> перезапуске туннеля, актуальная ссылка указывается здесь на момент защиты. Приложение всегда можно запустить
> локально одной командой (см. «Запуск одной командой»).

## Стек (зафиксирован)

| Слой | Технологии |
|---|---|
| Frontend | React 18, TypeScript (strict), Vite, React Router, TanStack Query, Tailwind CSS, i18next, Recharts, Socket.IO client |
| Backend | NestJS 10 (Node.js + TypeScript), Prisma ORM, Passport JWT, class-validator, Socket.IO |
| БД | PostgreSQL 16, миграции Prisma |
| API-документация | OpenAPI 3 — Swagger UI на `/api/docs`, спецификация в `docs/openapi.yaml` |
| Инфраструктура | Docker, Docker Compose, Nginx |
| Тесты | Jest + Supertest (backend), Vitest + Testing Library (frontend) |
| CI | GitHub Actions: линтер → форматтер → тесты → сборка → Docker-образы |

## Запуск одной командой

```bash
cp .env.example .env          # при необходимости поменяйте пароли и JWT_ACCESS_SECRET
docker compose up --build
```

В PowerShell вместо `cp` используйте `copy .env.example .env`.

- Приложение: http://localhost:8080
- Swagger UI: http://localhost:8080/api/docs (или http://localhost:3000/api/docs)

При старте контейнер backend применяет миграции и (при `RUN_SEED=true`) наполняет БД тестовыми данными.
Остановить: `docker compose down`; сбросить базу и загруженные файлы: `docker compose down -v`.

## Тестовые учётные записи

| Роль | Email | Пароль |
|---|---|---|
| Администратор | `admin@example.com` | `Admin123!` |
| Сотрудник | `employee@example.com` | `Employee123!` |
| Сотрудник | `employee2@example.com` | `Employee123!` |
| Гость | без входа: просмотр комнат и расписания | — |

В seed: 6 комнат, 5 удобств, несколько бронирований на ближайшие дни.

## Разработка без Docker

```bash
# 1. БД
docker run -d --name booking-db -e POSTGRES_USER=booking -e POSTGRES_PASSWORD=booking \
  -e POSTGRES_DB=booking -p 5432:5432 postgres:16-alpine

# 2. Backend
cd backend
cp .env.example .env
npm install
npx prisma migrate deploy
npx prisma db seed
npm run start:dev            # http://localhost:3000/api

# 3. Frontend (в другом терминале)
cd frontend
npm install
npm run dev                  # http://localhost:5173 (прокси на backend настроен в vite.config.ts)
```

Файлы `package-lock.json` закоммичены в `backend/` и `frontend/`, в CI используется `npm ci`.
Перед коммитом выполняйте `npm run format` и `npm run lint` в обеих папках: форматтер и линтер проверяются в CI.

## Тесты

```bash
cd backend  && npm run test:cov    # unit-тесты сервисного слоя + покрытие (порог 60%)
cd backend  && npm run test:e2e    # интеграционные тесты на реальной БД (DATABASE_URL + migrate deploy)
cd frontend && npm test            # тесты компонентов
```

Интеграционные тесты очищают таблицы, поэтому запускайте их только на отдельной базе (например, `booking_test`),
никогда не на рабочей.

Результаты: backend — 75 unit-тестов, покрытие 91 % (порог 60 %), 15 интеграционных тестов;
frontend — 15 тестов компонентов. Список тестов и отчёт о покрытии: `docs/TEST_REPORT.md`.

## Структура репозитория

```
backend/                NestJS API
  prisma/               schema.prisma, миграции, seed.ts
  src/
    auth/ users/ rooms/ bookings/ notifications/ stats/    модули: controller -> service -> Prisma
    common/             guards, фильтр ошибок, интерцептор ответов, пагинация, загрузка файлов
  test/                 интеграционные тесты (e2e)
frontend/               React SPA
  src/{api,auth,components,pages,i18n,theme,lib}
docs/                   OpenAPI, архитектура и ER, user stories, отчёт о тестировании
.github/workflows/      CI
docker-compose.yml      db + backend + frontend (Nginx)
```

## Функциональность (MVP по ТЗ)

| Требование | Реализация |
|---|---|
| Регистрация, вход, JWT access + refresh, выход, восстановление пароля | `auth/`: ротация refresh-токенов, хэши токенов в БД, ссылка сброса выводится в лог backend |
| RBAC, ≥ 3 ролей, проверка на сервере | роли guest / employee / admin; `RolesGuard`, проверка владельца брони в `BookingsService` |
| CRUD с подтверждением удаления | комнаты, бронирования, пользователи; `ConfirmDialog` на клиенте |
| Списки: пагинация, поиск, сортировка, фильтры на сервере | комнаты, брони, пользователи, уведомления |
| Валидация на клиенте и сервере | формы с сообщениями об ошибках; DTO + `ValidationPipe`, единый формат ошибок |
| Загрузка файлов с ограничением типа и размера | аватар (JPG/PNG ≤ 2 МБ), фото комнаты (≤ 5 МБ) |
| Личный кабинет | профиль, аватар, смена пароля, история бронирований |
| Панель администратора | комнаты, пользователи (роли, блокировка) |
| Дашборд с графиком | `/admin/dashboard`: брони по дням, загрузка комнат, сводка |
| Адаптивность 360–1920 px | Tailwind, мобильное меню, таблицы с горизонтальной прокруткой |

### Дополнительный функционал

- Уведомления в реальном времени (WebSocket / Socket.IO): владелец брони и администраторы узнают о создании, изменении и отмене.
- Тёмная тема и интернационализация RU/EN; выбор сохраняется в профиле.

## Основной сценарий для демонстрации

1. Гость открывает список комнат, фильтрует, смотрит расписание комнаты.
2. Сотрудник входит, выбирает слот и бронирует; второй сотрудник пытается занять тот же слот и получает ошибку.
3. Сотрудник отменяет бронь, администратор мгновенно получает уведомление (WebSocket).
4. Администратор создаёт комнату с фото, меняет роль пользователя, блокирует пользователя, смотрит дашборд.
5. Переключение темы и языка.

## Процесс разработки

- Ветка `main` защищена: изменения только через Pull Request, перед слиянием должны пройти проверки CI (`backend`, `frontend`, `docker`).
- Работа в feature-ветках (`feat/…`, `fix/…`, `ci/…`).
- Описание PR содержит чек-лист самопроверки (`.github/pull_request_template.md`).
- Сообщения коммитов — Conventional Commits (`feat: …`, `fix: …`, `test: …`, `docs: …`, `chore: …`).
- CI на каждый PR: ESLint → Prettier → тесты → сборка → Docker-образы.
- Задачи ведутся на канбан-доске (GitHub Projects), user stories — `docs/USER_STORIES.md`.

## Деплой

### Временный стенд через Cloudflare Tunnel (используется сейчас)

Приложение запускается в Docker на компьютере разработчика и публикуется наружу через quick tunnel:

```bash
docker compose up -d
cloudflared tunnel --url http://localhost:8080
# в выводе появится адрес вида https://что-то-там.trycloudflare.com
```

Затем в `.env` указать полученный адрес (без слэша в конце) и пересоздать backend, иначе CORS и WebSocket не заработают:

```bash
# .env
FRONTEND_URL=https://что-то-там.trycloudflare.com

docker compose up -d --force-recreate backend
```

Ограничения: стенд доступен, пока работают компьютер, Docker и процесс `cloudflared`; адрес меняется при каждом запуске туннеля.

### VPS колледжа / любой сервер с Docker

```bash
git clone <репозиторий> && cd room-booking
cp .env.example .env
# в .env: надёжные POSTGRES_PASSWORD и JWT_ACCESS_SECRET, FRONTEND_URL=https://ваш-домен, RUN_SEED=true (на первый запуск)
docker compose up -d --build
```

Для HTTPS поставьте перед контейнером frontend обратный прокси (Caddy или Nginx + certbot) на порт `WEB_PORT`.
После первого запуска можно выставить `RUN_SEED=false`, чтобы не создавать тестовые данные повторно
(повторный запуск seed безопасен: он ничего не затирает).

### Бесплатный хостинг (Render)

1. PostgreSQL: создать Render PostgreSQL, скопировать Internal Database URL.
2. Backend: Web Service из `backend/` (Docker). Переменные: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `FRONTEND_URL` (адрес клиента), `RUN_SEED=true`.
3. Frontend: Web Service из `frontend/` (Docker); в `frontend/nginx.conf` замените `http://backend:3000` на публичный адрес backend-сервиса Render.
4. Загруженные файлы на бесплатном плане Render не сохраняются между перезапусками — для демонстрации это допустимо; на VPS файлы лежат в томе `uploads`.

## Документация

- `docs/openapi.yaml` и Swagger UI на `/api/docs`
- `docs/ARCHITECTURE.md` — компоненты, слои, ER-диаграмма, защита от пересечений, меры безопасности
- `docs/USER_STORIES.md` — 13 user stories с критериями приёмки
- `docs/TEST_REPORT.md` — список тестов и покрытие
