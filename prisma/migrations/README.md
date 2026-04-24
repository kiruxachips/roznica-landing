# Prisma Migrations — заметки

## Timestamp collision 20260424220000

В директории есть две миграции с одинаковым timestamp:

- `20260424220000_premium_coffee_attrs`
- `20260424220000_wholesale_phases_5_8`

Они уже applied на проде (в `_prisma_migrations` таблице записаны обе).
**Переименовывать нельзя** — Prisma увидит их как новые и попытается re-apply,
что сломает schema.

Prisma CLI применяет миграции в lexicographic-order. Для идентичных timestamp —
alphabetical по имени:
1. `premium_coffee_attrs` (раньше)
2. `wholesale_phases_5_8` (позже)

Это работает потому что между миграциями нет зависимостей (premium ALTER
TABLE "Product" добавляет колонки, wholesale CREATE TABLE независимые
модели).

**В будущем:** следить чтобы timestamp'ы были уникальными. Именование —
`YYYYMMDDHHMMSS_short_name`. При параллельной разработке двух миграций
соблюдать хотя бы минутную разницу.

## Политика rollback

`prisma migrate` не имеет встроенного rollback. Если миграция сломала прод:
1. Остановить контейнер (`docker compose stop app`).
2. Написать compensating migration (например, DROP COLUMN) с новым timestamp.
3. `prisma migrate resolve --rolled-back <name>` чтобы пометить упавшую как отменённую.
4. Применить compensating через `prisma migrate deploy`.

Для data-loss миграций — всегда делать бэкап перед deploy (`scripts/backup.sh`).

## Безопасные migration паттерны

При добавлении колонки:
1. Сделать колонку nullable (ADD COLUMN ... DEFAULT NULL).
2. Backfill существующих строк в миграции или отдельном скрипте.
3. Если нужно NOT NULL — отдельной второй миграцией, **после** того как
   приложение в проде уже пишет значения.

При удалении колонки: обратный порядок — сначала код перестаёт её использовать,
потом миграция DROP COLUMN.
