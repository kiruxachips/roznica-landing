# Backup & Restore

## Automatic daily backups

Cron на сервере (beget):

```cron
# /etc/cron.d/roznica-backup
0 3 * * * user cd /home/user/roznica-landing && ./scripts/backup.sh >> /var/log/roznica-backup.log 2>&1
```

Запускается в 03:00 UTC каждый день. Делает:
- `docker exec roznica-db pg_dump -Fc …` в `backups/daily/db_YYYYMMDD_HHMMSS.dump.gz`
- По воскресеньям дополнительно копирует в `backups/weekly/`
- Ротация: 7 daily + 4 weekly (≈1 месяц глубины)
- Опционально — S3-upload (Yandex Object Storage / Selectel) если в `.env` заданы
  `S3_BUCKET` и `S3_ENDPOINT`, и `aws` CLI установлен

## Ручная проверка:

```bash
./scripts/backup.sh
ls -la backups/daily/
```

Первый запуск должен создать файл в `backups/daily/` без ошибок.

## Restore

```bash
# Из daily snapshot:
gunzip < backups/daily/db_YYYYMMDD_HHMMSS.dump.gz | \
  docker exec -i roznica-db pg_restore \
    -U $POSTGRES_USER -d $POSTGRES_DB \
    --clean --if-exists

# Тестовый restore в staging-БД (безопасная проверка):
createdb -U postgres roznica_staging
gunzip < backups/daily/db_YYYYMMDD_HHMMSS.dump.gz | \
  pg_restore -U postgres -d roznica_staging
```

## Рекомендация по тестированию

Раз в месяц — ручной restore в отдельную базу + `SELECT COUNT(*) FROM "Order"`
чтобы убедиться что бэкап не битый. Лучше сегодня поднимать alert если
файл < 1MB (потенциально пустой dump).

## S3 setup (опционально)

Для Yandex Object Storage:

```bash
# В .env
S3_BUCKET=roznica-backups
S3_ENDPOINT=https://storage.yandexcloud.net
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_DEFAULT_REGION=ru-central1

# Установить AWS CLI:
apt-get install awscli   # debian
```

После этого `backup.sh` автоматически копирует дамп в S3.
