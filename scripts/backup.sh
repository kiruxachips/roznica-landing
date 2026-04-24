#!/usr/bin/env bash
# Daily-backup скрипт для Postgres-контейнера roznica-db.
#
# Что делает:
#   1. pg_dump БД в custom-format (быстрее restore + compressible)
#   2. Ротация: оставляем 7 daily + 4 weekly (snapshot каждого воскресенья)
#   3. Опционально — upload на S3-compatible (Yandex Object Storage / Selectel)
#      через AWS CLI (если настроено окружение)
#
# Запуск на сервере beget:
#   - Cron: 0 3 * * *  /home/user/roznica-landing/scripts/backup.sh >> /var/log/roznica-backup.log 2>&1
#   - Или systemd timer
#
# Переменные окружения (из .env):
#   POSTGRES_USER, POSTGRES_DB, POSTGRES_PASSWORD — должны быть доступны
#   BACKUP_DIR — директория для файлов (default: ./backups)
#   S3_BUCKET — optional, если задано, upload в S3
#   S3_ENDPOINT — optional, https://storage.yandexcloud.net
#
# Ручной restore:
#   gunzip < db_YYYYMMDD_HHMMSS.dump.gz | \
#     docker exec -i roznica-db pg_restore -U $POSTGRES_USER -d $POSTGRES_DB --clean --if-exists

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Загружаем .env из проекта если есть
if [ -f "$PROJECT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$PROJECT_DIR/.env"
  set +a
fi

: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"

BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"
CONTAINER="${POSTGRES_CONTAINER:-roznica-db}"

mkdir -p "$BACKUP_DIR/daily" "$BACKUP_DIR/weekly"

TS=$(date -u +%Y%m%d_%H%M%S)
DAILY_FILE="$BACKUP_DIR/daily/db_${TS}.dump"

echo "[$(date -Iseconds)] Starting pg_dump of $POSTGRES_DB from container $CONTAINER"
docker exec "$CONTAINER" pg_dump \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  -Fc \
  --no-owner \
  --no-privileges \
  > "$DAILY_FILE"

gzip -9 "$DAILY_FILE"
DAILY_FILE="${DAILY_FILE}.gz"
SIZE=$(du -h "$DAILY_FILE" | cut -f1)
echo "[$(date -Iseconds)] Daily backup saved: $DAILY_FILE ($SIZE)"

# По воскресеньям — копируем в weekly/
DOW=$(date +%u)  # 7 = Sunday
if [ "$DOW" = "7" ]; then
  WEEKLY_FILE="$BACKUP_DIR/weekly/db_${TS}.dump.gz"
  cp "$DAILY_FILE" "$WEEKLY_FILE"
  echo "[$(date -Iseconds)] Weekly snapshot saved: $WEEKLY_FILE"
fi

# Ротация daily — оставляем 7 последних
find "$BACKUP_DIR/daily" -name 'db_*.dump.gz' -type f -mtime +7 -delete -print | \
  sed "s|^|[$(date -Iseconds)] Removed old daily: |"

# Ротация weekly — оставляем 4 последних (≈1 месяц)
find "$BACKUP_DIR/weekly" -name 'db_*.dump.gz' -type f -mtime +30 -delete -print | \
  sed "s|^|[$(date -Iseconds)] Removed old weekly: |"

# Optional S3 upload
if [ -n "${S3_BUCKET:-}" ] && command -v aws >/dev/null 2>&1; then
  echo "[$(date -Iseconds)] Uploading to S3: $S3_BUCKET"
  AWS_EXTRA=""
  if [ -n "${S3_ENDPOINT:-}" ]; then
    AWS_EXTRA="--endpoint-url $S3_ENDPOINT"
  fi
  # shellcheck disable=SC2086
  aws s3 cp "$DAILY_FILE" "s3://$S3_BUCKET/daily/" $AWS_EXTRA
  if [ "$DOW" = "7" ]; then
    # shellcheck disable=SC2086
    aws s3 cp "$WEEKLY_FILE" "s3://$S3_BUCKET/weekly/" $AWS_EXTRA
  fi
fi

echo "[$(date -Iseconds)] Backup complete."
