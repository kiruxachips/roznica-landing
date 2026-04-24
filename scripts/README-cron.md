# Cron endpoints

Все cron-эндпоинты защищены `CRON_SECRET` из `.env`. Внешний планировщик
(cron на сервере beget, Vercel Cron, EasyCron и т.п.) отправляет GET с
`Authorization: Bearer ${CRON_SECRET}`.

## Настройка на beget

Добавить в `/etc/cron.d/roznica` или через crontab:

```cron
# Email retry (dead-letter queue из EmailDispatch) — каждые 5 минут
*/5 * * * * user curl -s -H "Authorization: Bearer ${CRON_SECRET}" https://millor-coffee.ru/api/cron/retry-emails > /dev/null

# Abandoned cart recovery — каждые 15 минут
*/15 * * * * user curl -s -H "Authorization: Bearer ${CRON_SECRET}" https://millor-coffee.ru/api/cron/abandoned-cart-recovery > /dev/null

# Review prompts — раз в день в 10:00 UTC (13:00 MSK — адекватное время для email)
0 10 * * * user curl -s -H "Authorization: Bearer ${CRON_SECRET}" https://millor-coffee.ru/api/cron/review-prompts > /dev/null

# DB backup — раз в сутки в 03:00 UTC
0 3 * * * user cd /home/user/roznica-landing && ./scripts/backup.sh >> /var/log/roznica-backup.log 2>&1
```

## Проверка работы

```bash
# Smoke-test health
curl https://millor-coffee.ru/api/health

# Вручную запустить cron
curl -H "Authorization: Bearer ${CRON_SECRET}" https://millor-coffee.ru/api/cron/abandoned-cart-recovery
```

## TODO

- Мониторинг: не ударил ли эндпоинт timeout / не возвращает ли 5xx (UptimeRobot).
- Метрики cron-выполнения (sent/failed/expired) стоит писать в IntegrationLog
  для просмотра через /admin/integrations.
