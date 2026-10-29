-- Запрет пересечений бронирований на уровне БД.
-- Создаётся после первой миграции (init), которая создаёт таблицы.
-- Нарушение ограничения = ошибка Postgres с кодом 23P01 -> API отвечает 409 Conflict.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_ends_after_starts" CHECK ("ends_at" > "starts_at");

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_no_overlap"
  EXCLUDE USING gist (
    "room_id" WITH =,
    tstzrange("starts_at", "ends_at") WITH &&
  ) WHERE ("status" = 'ACTIVE');
