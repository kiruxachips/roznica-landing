# План интеграции `millorbot-delivery` с сайтом `roznica-landing`

**Цель:** подключить бот к новому сайту так, чтобы после оплаты заказа сайт сам пушил полные данные в бот (без IMAP), а бот присылал обратно обновления трек-номеров и статусов через подписанные HTTPS-webhook'и.

Этот план выполняется в отдельной Claude-сессии **в локальной папке бота** (`millorbot-delivery` / `millor-delivery-bot`). После правок — `git push` → на сервере `git pull && docker compose up -d --build`.

---

## 0. Контекст: что уже готово на сайте

**Сайт (`roznica-landing`) уже умеет:**

1. **Отправлять событие `order.paid`** в бот. Событие попадает в таблицу `OutboxEvent` в момент успешной оплаты YooKassa, а отдельный контейнер `roznica-outbox-worker` асинхронно доставляет его с экспоненциальным backoff (5 с → 25 с → 2 мин → 10 мин → 1 ч → 5 ч → 1 день, максимум `OUTBOX_MAX_ATTEMPTS=10` попыток, после чего событие уходит в `status=dead`).
2. **Принимать `tracking.updated`** по эндпоинту `POST /api/webhooks/millorbot/tracking`. Эндпоинт проверяет HMAC-подпись, timestamp (±5 минут), идемпотентность по `event_id`, обновляет `Order.trackingNumber/carrierStatus/status`, пишет запись в `OrderStatusLog` и триггерит письма клиенту на переходах `→shipped` и `→delivered`.
3. **Admin UI** `/admin/integrations` — мониторинг обоих направлений + ручной retry.

**Общий shared secret** (hex 64 символа) хранится в ENV и с одной, и с другой стороны:

* на сайте: `MILLORBOT_SHARED_SECRET`
* в боте: `WEBSITE_SHARED_SECRET`

Генерируется один раз: `openssl rand -hex 32`.

**Общая Docker-сеть** `millor-backbone` (external) — **уже создана на сервере**, контейнер сайта `roznica-landing` и worker `roznica-outbox-worker` в неё включены. Боту нужно только присоединиться (см. раздел 5).

---

## 0.1 Текущее состояние на сервере (на 2026-04-17)

Сайт задеплоен, готов принимать и отправлять события. Текущая конфигурация:

| Что | Где | Значение |
|---|---|---|
| Docker-сеть | сервер beget | `millor-backbone` создана |
| Контейнер сайта | `roznica-landing` | в сети `millor-backbone`, DNS: `roznica-landing`, порт внутри `3000` |
| Outbox worker | `roznica-outbox-worker` | в сети `millor-backbone`, сейчас `MILLORBOT_ENABLED=false` |
| Inbound endpoint | готов | `POST http://roznica-landing:3000/api/webhooks/millorbot/tracking` |
| Админка | `https://millor-coffee.ru/admin/integrations` | мониторинг outbox + журнал |

**Shared secret** (HMAC-ключ на обе стороны) — 64-символьный hex. Запросить у пользователя **Кирилла** или взять из `.env` файла сайта на сервере:
```bash
ssh beget 'grep MILLORBOT_SHARED_SECRET ~/roznica-landing/.env'
```
**Ровно это значение** нужно положить в `.env` бота как `WEBSITE_SHARED_SECRET`. Без совпадения секретов обе стороны будут возвращать 401.

**Ожидаемые значения в `.env` бота после всех работ:**
```
WEBSITE_API_URL=http://roznica-landing:3000/api/webhooks/millorbot/tracking
WEBSITE_SHARED_SECRET=<hex 64, тот же что на сайте>
HTTP_SERVER_ENABLED=true
HTTP_SERVER_PORT=8000
IMAP_ENABLED=true   # оставить true на переходный период; позже false
```

**После запуска бота Кирилл на сервере включит outbox-воркер:**
```bash
ssh beget 'cd ~/roznica-landing && sed -i "s/MILLORBOT_ENABLED=false/MILLORBOT_ENABLED=true/" .env && docker compose restart outbox-worker'
```
До этого момента все `order.paid` копятся в БД сайта со `status=pending` — ничего не теряется.

---

## 1. Контракт HTTP (это закон, менять нельзя)

### 1.1 Сайт → Бот: `POST {MILLORBOT_URL}/api/orders/paid`

**Заголовки:**
```
Content-Type: application/json
X-Millorbot-Timestamp: <unix-seconds>
X-Millorbot-Signature: sha256=<hex of HMAC-SHA256(secret, "{timestamp}.{raw_body}")>
```

**Тело (полностью структурированный JSON, никакого парсинга писем):**
```json
{
  "event_id": "paid_clx...",
  "event": "order.paid",
  "occurred_at": "2026-04-17T12:00:00Z",
  "order": {
    "id": "clx...",
    "number": "MC-260417-A1B2",
    "total": 5400,
    "subtotal": 5000,
    "discount": 0,
    "deliveryPrice": 400,
    "bonusUsed": 0,
    "customer": {
      "name": "Иванов Иван",
      "email": "ivan@example.com",
      "phone": "+79991234567"
    },
    "shipping": {
      "carrier": "cdek",
      "type": "pvz",
      "city": "Москва",
      "cityCode": 44,
      "postalCode": "101000",
      "address": "ул. Тверская, 10",
      "pickupPointCode": "MSK123",
      "pickupPointName": "ПВЗ у м. Пушкинская",
      "carrierOrderId": "uuid-from-cdek",
      "carrierOrderNum": "1234567",
      "trackingNumber": null,
      "estimatedDelivery": "3-5 дней",
      "tariffCode": 136,
      "packageWeight": 500
    },
    "items": [
      { "name": "Эфиопия Иргачеффе", "weight": "250г", "price": 1300, "quantity": 2 }
    ],
    "notes": "Позвонить перед доставкой",
    "paymentMethod": "online",
    "paymentId": "yookassa-uuid",
    "adminUrl": "https://millor-coffee.ru/admin/orders/clx..."
  }
}
```

**Ожидаемый ответ:**
* `200` / `201` / `202` с телом `{ "ok": true, "event_id": "..." }` — доставлено, сайт отмечает событие как `delivered`.
* `4xx` (кроме 408, 429) — **перманентная ошибка**, сайт не повторяет, событие → `dead`. Возвращать только при реальных ошибках валидации payload или битой подписи.
* `5xx` / `408` / `429` / network error — временная, сайт будет ретраить с backoff.

**Идемпотентность — ответственность бота:** при повторном приходе того же `event_id` бот должен вернуть `200 ok` без повторной обработки (НЕ слать ещё раз в Telegram, НЕ добавлять строку в Sheets). Текущий паттерн с `processed (order_id)` в SQLite — хорошая база, но **переключаем ключ идемпотентности на `event_id`**, а не на `order.number`, потому что один и тот же заказ теоретически может получить несколько событий в будущем (например, `order.status.changed`).

### 1.2 Бот → Сайт: `POST {WEBSITE_API_URL}`

`WEBSITE_API_URL` теперь полностью указывает на endpoint: `https://millor-coffee.ru/api/webhooks/millorbot/tracking` (или `http://roznica-landing:3000/api/webhooks/millorbot/tracking` внутри docker-сети).

**Заголовки:**
```
Content-Type: application/json
X-Millorbot-Timestamp: <unix-seconds>
X-Millorbot-Signature: sha256=<hex of HMAC-SHA256(secret, "{timestamp}.{raw_body}")>
```

**Тело:**
```json
{
  "event_id": "trk_<uuid>",
  "occurred_at": "2026-04-17T13:00:00Z",
  "orderNumber": "MC-260417-A1B2",
  "carrier": "cdek",
  "trackingNumber": "1068998800",
  "status": {
    "code": "IN_TRANSIT",
    "text": "Посылка в пути",
    "normalized": "in_transit"
  },
  "carrierOrderId": "uuid-from-cdek"
}
```

**`status.normalized` — жёсткий enum**, сайт решает по нему, менять ли `Order.status`:
- `pending` — не меняет
- `shipped` / `in_transit` / `arrived` — переводит в `shipped` (если разрешено ALLOWED_TRANSITIONS)
- `delivered` — переводит в `delivered`
- `returned` / `exception` — сайт оставляет `Order.status` как есть, но пишет `carrierStatus`

**Ответ от сайта:**
* `200 { ok: true, applied: [...] }` — принято.
* `200 { ok: true, idempotent: true }` — дубликат `event_id`, сайт уже обработал.
* `401` — битая подпись / протухший timestamp → НЕ ретраить, проверь секрет/часы.
* `404` — заказ с таким `orderNumber` не найден → НЕ ретраить, что-то со стороны бота.
* `5xx` — временная, можно ретраить.

**Номер заказа — произвольная строка**, не `NNNN/NNN`. Сайт генерирует формата `MC-YYMMDD-XXXX` (например, `MC-260417-A1B2`). Бот **не должен валидировать формат регулярками** — просто передаёт строку как есть.

### 1.3 HMAC — точный алгоритм (критично для обеих сторон)

```
timestamp = floor(time() / 1000)  # unix-seconds
message = f"{timestamp}.{raw_body_bytes}"
signature = hmac.new(secret.encode(), message.encode(), sha256).hexdigest()
header = f"sha256={signature}"
```

**При верификации:**
1. Прочитать raw тело (важно — ДО json-декода, иначе подпись не совпадёт: пробелы, порядок ключей).
2. Проверить `abs(now - timestamp) <= 300` (5 минут) — защита от replay.
3. Пересчитать подпись, сравнить через `hmac.compare_digest` (константное время).

На сайте это реализовано в `lib/integrations/hmac.ts`. В боте нужно реализовать идентично.

---

## 2. Структура изменений в боте

### Новые файлы:
1. `src/http_server.py` — aiohttp-web / FastAPI приложение, один endpoint `POST /api/orders/paid`.
2. `src/hmac_util.py` — `sign(body, secret)` + `verify(body, ts_hdr, sig_hdr, secret)`.
3. `src/processed_events.py` — идемпотентность по `event_id` (новая таблица в SQLite).
4. `src/website_client_v2.py` или переписать `website_client.py` — HMAC + новый payload.

### Изменения:
5. `src/main.py` — запуск HTTP-сервера параллельно с IMAP/scheduler + флаг `IMAP_ENABLED`.
6. `src/database.py` — добавить таблицу `processed_events` (event_id UNIQUE).
7. `src/config.py` — новые ENV: `WEBSITE_SHARED_SECRET`, `HTTP_SERVER_ENABLED`, `HTTP_SERVER_PORT`, `IMAP_ENABLED`.
8. `src/scheduler.py` — вызовы `upsert_tracking` перевести на новый клиент.
9. `docker-compose.yml` — подключение к сети `millor-backbone`, публикация порта 8000 (только внутрь сети), новые env.
10. `requirements.txt` — добавить `aiohttp` (если ещё не стоит — скорее всего уже есть, т.к. aiogram использует).
11. `.env.example` — задокументировать новые переменные.

---

## 3. Пошаговая реализация

### Шаг 1 — HMAC util

Создать `src/hmac_util.py`:

```python
"""HMAC signing/verification for website ↔ bot integration.

Protocol: HMAC-SHA256 over "{timestamp}.{raw_body}" with shared secret.
Signature header format: "sha256=<hex>".
Timestamp tolerance: ±300s.
"""
import hmac
import hashlib
import time
from dataclasses import dataclass
from typing import Optional

MAX_SKEW_SECONDS = 300


@dataclass
class VerifyResult:
    ok: bool
    reason: Optional[str] = None


def sign(raw_body: bytes | str, secret: str, timestamp: Optional[int] = None) -> tuple[str, str]:
    """Return (timestamp_header_value, signature_header_value)."""
    ts = timestamp if timestamp is not None else int(time.time())
    body = raw_body.encode() if isinstance(raw_body, str) else raw_body
    msg = f"{ts}.".encode() + body
    sig = hmac.new(secret.encode(), msg, hashlib.sha256).hexdigest()
    return str(ts), f"sha256={sig}"


def verify(raw_body: bytes, timestamp_header: Optional[str], signature_header: Optional[str],
           secret: str, now: Optional[int] = None) -> VerifyResult:
    if not timestamp_header or not signature_header:
        return VerifyResult(False, "missing_headers")
    try:
        ts = int(timestamp_header)
    except ValueError:
        return VerifyResult(False, "bad_format")

    now = now if now is not None else int(time.time())
    if abs(now - ts) > MAX_SKEW_SECONDS:
        return VerifyResult(False, "stale_timestamp")

    prefix = "sha256="
    if not signature_header.startswith(prefix):
        return VerifyResult(False, "bad_format")
    provided = signature_header[len(prefix):]

    expected = hmac.new(
        secret.encode(),
        f"{ts}.".encode() + raw_body,
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(provided, expected):
        return VerifyResult(False, "bad_signature")
    return VerifyResult(True)
```

### Шаг 2 — Идемпотентность

В `src/database.py` добавить таблицу:

```sql
CREATE TABLE IF NOT EXISTS processed_events (
    event_id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    received_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

Функции:
- `is_event_processed(event_id: str) -> bool`
- `mark_event_processed(event_id: str, source: str = "website") -> None`

### Шаг 3 — HTTP-сервер с `/api/orders/paid`

Создать `src/http_server.py` (используем `aiohttp-web`, поскольку aiogram уже на asyncio):

```python
from aiohttp import web
from datetime import datetime
import logging
import json

from .hmac_util import verify
from .config import Config
from .parser import ParsedOrder  # существующий класс
from .database import Database
from .router import OrderRouter
from .google_sheets import GoogleSheetsClient
from .bot import TelegramBot

log = logging.getLogger(__name__)


class AppContext:
    def __init__(self, db: Database, router: OrderRouter, sheets: GoogleSheetsClient, bot: TelegramBot):
        self.db = db
        self.router = router
        self.sheets = sheets
        self.bot = bot


def parsed_order_from_payload(order: dict) -> ParsedOrder:
    """Convert JSON payload to the internal ParsedOrder shape used by router/sheets/bot."""
    shipping = order.get("shipping", {}) or {}
    customer = order.get("customer", {}) or {}
    items = order.get("items", []) or []

    # Формируем тело в том же стиле, как раньше парсили из email —
    # чтобы не менять формат сообщений в Telegram.
    body_lines = [
        f"Заказ: #{order['number']}",
        f"Получатель: {customer.get('name', '')}",
        f"Телефон: {customer.get('phone', '')}",
        f"Email: {customer.get('email') or '—'}",
        f"Город: {shipping.get('city', '')}",
        f"Служба доставки: {shipping.get('carrier', '')}",
        f"Способ доставки: {'ПВЗ' if shipping.get('type') == 'pvz' else 'До двери'}",
        f"Адрес: {shipping.get('address') or shipping.get('pickupPointName') or ''}",
        f"Комментарий: {order.get('notes') or '—'}",
        "",
        "Состав заказа:",
    ]
    for item in items:
        body_lines.append(f"  • {item['name']} ({item['weight']}) — {item['quantity']} шт. × {item['price']}₽")
    body_lines.append("")
    body_lines.append(f"Итого: {order['total']}₽")

    return ParsedOrder(
        order_id=order["number"],
        city=shipping.get("city", ""),
        region=None,
        delivery_service=_normalize_carrier(shipping.get("carrier")),
        recipient=customer.get("name"),
        phone=customer.get("phone"),
        delivery_method=("Доставка до ПВЗ" if shipping.get("type") == "pvz" else "Доставка до двери"),
        address=shipping.get("address") or shipping.get("pickupPointName"),
        comment=order.get("notes"),
        body="\n".join(body_lines),
        body_html=None,  # нет HTML — рендер в PNG пропускается, отправится обычный текст
        is_kaliningrad_yandex=(
            "калининград" in (shipping.get("city") or "").lower()
            and "яндекс" in (shipping.get("carrier") or "").lower()
        ),
    )


def _normalize_carrier(c: Optional[str]) -> str:
    if not c:
        return "Неизвестно"
    m = c.lower()
    if m == "cdek": return "CDEK"
    if m == "pochta": return "Почта России"
    if m == "courier": return "Курьер"
    if m == "yandex": return "Яндекс Такси"
    return c


async def handle_order_paid(request: web.Request):
    ctx: AppContext = request.app["ctx"]
    cfg: Config = request.app["config"]

    raw = await request.read()

    result = verify(
        raw,
        request.headers.get("X-Millorbot-Timestamp"),
        request.headers.get("X-Millorbot-Signature"),
        cfg.website_shared_secret,
    )
    if not result.ok:
        log.warning("HMAC verify failed: %s", result.reason)
        return web.json_response({"error": "unauthorized", "reason": result.reason}, status=401)

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return web.json_response({"error": "invalid_json"}, status=400)

    event_id = payload.get("event_id")
    order_data = payload.get("order")
    if not event_id or not order_data:
        return web.json_response({"error": "missing_fields"}, status=400)

    # Идемпотентность
    if ctx.db.is_event_processed(event_id):
        log.info("Duplicate event %s — skipping", event_id)
        return web.json_response({"ok": True, "event_id": event_id, "idempotent": True})

    try:
        parsed = parsed_order_from_payload(order_data)
        thread_id = ctx.router.route(parsed)
        await ctx.bot.send_to_topic(parsed, thread_id, image_path=None)
        ctx.sheets.log_order(parsed, thread_id=thread_id)
        ctx.db.mark_event_processed(event_id, source="website")
    except Exception:
        log.exception("Failed to process event %s", event_id)
        return web.json_response({"error": "internal"}, status=500)  # сайт ретраит

    return web.json_response({"ok": True, "event_id": event_id})


async def handle_health(_: web.Request):
    return web.json_response({"ok": True})


def create_app(ctx: AppContext, config: Config) -> web.Application:
    app = web.Application()
    app["ctx"] = ctx
    app["config"] = config
    app.router.add_post("/api/orders/paid", handle_order_paid)
    app.router.add_get("/health", handle_health)
    return app
```

**Важные моменты:**
- `await request.read()` — читаем raw bytes ДО попытки распарсить JSON, иначе подпись не совпадёт.
- Если существующий `OrderRouter.route()` синхронный и принимает `ParsedOrder` — всё работает как есть; никакой логики маршрутизации не меняем.
- Если `TelegramBot.send_to_topic()` принимает image — передаём `None` (сайт не шлёт PNG). Если метод этого не поддерживает, нужно либо сделать перегрузку, либо вставить в него условие `if image_path is None: send_text_only(...)`.

### Шаг 4 — Запуск HTTP-сервера в `main.py`

В `MillorRouterApp.run()`:

```python
from aiohttp import web
from .http_server import create_app, AppContext

async def run(self):
    # ... existing init ...

    if self.config.http_server_enabled:
        ctx = AppContext(db=self.db, router=self.router, sheets=self.sheets, bot=self.bot)
        app = create_app(ctx, self.config)
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, host="0.0.0.0", port=self.config.http_server_port)
        await site.start()
        logger.info("HTTP server listening on port %s", self.config.http_server_port)

    if self.config.imap_enabled:
        await self._poll_emails()  # существующий цикл
    else:
        logger.info("IMAP polling disabled — running in HTTP-only mode")
        # Оставляем процесс живым для HTTP-сервера и scheduler
        await asyncio.Event().wait()
```

### Шаг 5 — Переписать `website_client.py` на HMAC

```python
import json
import logging
from typing import Optional
import aiohttp
from .hmac_util import sign
from .config import Config

log = logging.getLogger(__name__)


class WebsiteClient:
    def __init__(self, config: Config):
        self.url = config.website_api_url  # полный путь к /api/webhooks/millorbot/tracking
        self.secret = config.website_shared_secret
        self.timeout = aiohttp.ClientTimeout(total=10)

    async def upsert_tracking(self, *, event_id: str, order_number: str, carrier: str,
                              tracking_number: Optional[str], status_code: str, status_text: str,
                              normalized: str, carrier_order_id: Optional[str] = None,
                              occurred_at: Optional[str] = None) -> bool:
        payload = {
            "event_id": event_id,
            "occurred_at": occurred_at or _now_iso(),
            "orderNumber": order_number,
            "carrier": carrier,
            "trackingNumber": tracking_number,
            "status": {
                "code": status_code,
                "text": status_text,
                "normalized": normalized,
            },
            "carrierOrderId": carrier_order_id,
        }
        raw = json.dumps(payload, ensure_ascii=False).encode()
        ts, sig = sign(raw, self.secret)

        try:
            async with aiohttp.ClientSession(timeout=self.timeout) as s:
                async with s.post(
                    self.url,
                    data=raw,
                    headers={
                        "Content-Type": "application/json",
                        "X-Millorbot-Timestamp": ts,
                        "X-Millorbot-Signature": sig,
                    },
                ) as r:
                    body = await r.text()
                    if r.status == 200:
                        log.info("tracking upserted: %s (%s)", order_number, normalized)
                        return True
                    if 400 <= r.status < 500 and r.status not in (408, 429):
                        # перманентная ошибка — не ретраим
                        log.error("tracking upsert permanent failure %d: %s", r.status, body[:300])
                        return False
                    log.warning("tracking upsert transient failure %d: %s", r.status, body[:300])
                    return False
        except Exception:
            log.exception("tracking upsert network error")
            return False
```

### Шаг 6 — Нормализация статуса CDEK/Pochta

Создать `src/status_normalizer.py`:

```python
# CDEK → normalized
CDEK_MAP = {
    "CREATED": "shipped",
    "ACCEPTED": "shipped",
    "RECEIVED_AT_SHIPMENT_WAREHOUSE": "shipped",
    "READY_FOR_SHIPMENT_IN_TRANSIT_CITY": "in_transit",
    "IN_TRANSIT": "in_transit",
    "ARRIVED_AT_RECIPIENT_CITY": "arrived",
    "ACCEPTED_AT_PICK_UP_POINT": "arrived",
    "TAKEN_BY_COURIER": "arrived",
    "DELIVERED": "delivered",
    "NOT_DELIVERED": "exception",
    "RETURNED": "returned",
    "SEIZED": "exception",
}

def normalize_cdek(code: str) -> str:
    return CDEK_MAP.get(code, "pending")


# Pochta (operation type ID от API pochta)
def normalize_pochta(operation_type_id: int) -> str:
    if operation_type_id == 2: return "delivered"
    if operation_type_id == 1: return "in_transit"
    if operation_type_id in (3, 5): return "returned"
    return "pending"
```

Подправить `src/scheduler.py` — при отправке tracking использовать нормализацию:

```python
from .status_normalizer import normalize_cdek

# в _cdek_tracking_job:
normalized = normalize_cdek(status_code)
await self.website_client.upsert_tracking(
    event_id=f"trk_cdek_{order_number}_{int(time.time())}",
    order_number=order_number,
    carrier="cdek",
    tracking_number=track_num,
    status_code=status_code,
    status_text=status_text,
    normalized=normalized,
    carrier_order_id=cdek_uuid,
)
```

**Формат event_id для исходящего:** `trk_<carrier>_<order_number>_<unix_timestamp>`. Сайт проверяет идемпотентность по этому ключу, так что повторный тот же status в том же цикле не пробьёт.

### Шаг 7 — Конфигурация

`src/config.py`:

```python
website_api_url: str = os.getenv("WEBSITE_API_URL", "")
website_shared_secret: str = os.getenv("WEBSITE_SHARED_SECRET", "")
http_server_enabled: bool = os.getenv("HTTP_SERVER_ENABLED", "true").lower() == "true"
http_server_port: int = int(os.getenv("HTTP_SERVER_PORT", "8000"))
imap_enabled: bool = os.getenv("IMAP_ENABLED", "true").lower() == "true"
```

Заменить старый `website_auth_token` на `website_shared_secret`.

### Шаг 8 — docker-compose.yml бота

```yaml
services:
  millor-router-bot:
    build: .
    container_name: millor-telegram-router
    restart: always
    env_file: [.env]
    volumes:
      - ./data:/app/data
      - ./src:/app/src:ro
    networks:
      - millor-network
      - millor-backbone
    # Порт НЕ публикуется наружу — только внутри docker-сети
    expose:
      - "8000"

networks:
  millor-network:
    driver: bridge
  millor-backbone:
    external: true
```

### Шаг 9 — `.env` на сервере

Добавить в `.env` бота:
```
# Новые переменные
WEBSITE_API_URL=http://roznica-landing:3000/api/webhooks/millorbot/tracking
WEBSITE_SHARED_SECRET=<тот же hex 64, что MILLORBOT_SHARED_SECRET у сайта>
HTTP_SERVER_ENABLED=true
HTTP_SERVER_PORT=8000
IMAP_ENABLED=true   # оставляем на переходный период; false после стабилизации
```

Удалить: `WEBSITE_AUTH_TOKEN` (заменён на `WEBSITE_SHARED_SECRET`).

---

## 4. План тестирования

### 4.1 Unit-тесты HMAC

```python
def test_roundtrip():
    body = b'{"hello":"world"}'
    ts, sig = sign(body, "secret", timestamp=1000)
    assert verify(body, ts, sig, "secret", now=1000).ok

def test_stale():
    ts, sig = sign(b"{}", "secret", timestamp=1000)
    assert verify(b"{}", ts, sig, "secret", now=2000).reason == "stale_timestamp"

def test_tampered_body():
    ts, sig = sign(b'{"a":1}', "secret", timestamp=1000)
    assert verify(b'{"a":2}', ts, sig, "secret", now=1000).reason == "bad_signature"
```

### 4.2 E2E локально

1. Запустить сайт + postgres локально (`docker compose up`).
2. Запустить бота локально (`python -m src.main`) с `WEBSITE_API_URL=http://host.docker.internal:3004/api/webhooks/millorbot/tracking`.
3. Сгенерить оплаченный заказ (либо прогнать вручную через YooKassa sandbox, либо вызвать хук вручную — см. ниже).
4. Проверить:
   - В логах бота: запрос пришёл, подпись валидна, сообщение ушло в Telegram (тестовую группу).
   - В Google Sheets добавилась строка.
   - В базе бота в `processed_events` добавился `event_id`.

### 4.3 Ручная эмуляция без YooKassa

Скрипт на стороне сайта для тестового пуша:

```bash
# В корне roznica-landing
cat > /tmp/push-test.ts <<'EOF'
import { enqueueOutbox } from "./lib/dal/outbox"
import { buildOrderPaidPayload } from "./lib/integrations/millorbot/payload"
import { prisma } from "./lib/prisma"

const order = await prisma.order.findFirst({
  where: { status: "paid" },
  include: { items: true },
  orderBy: { createdAt: "desc" },
})
if (!order) { console.error("no paid orders"); process.exit(1) }

const eventId = `paid_test_${Date.now()}`
const payload = buildOrderPaidPayload(order, { eventId })
await enqueueOutbox("order.paid", payload as any, { eventId })
console.log("enqueued", eventId)
EOF
npx tsx /tmp/push-test.ts
```

И проверить `/admin/integrations` — событие появится в outbox, через 5 секунд worker его подхватит.

### 4.4 Обратный путь (tracking.updated)

Вручную вызвать upsert с правильной подписью:

```python
# scripts/manual_tracking_push.py
import asyncio, json, hmac, hashlib, time
import aiohttp

SECRET = "...the shared hex..."
URL = "http://localhost:3004/api/webhooks/millorbot/tracking"

async def main():
    payload = {
        "event_id": f"trk_manual_{int(time.time())}",
        "occurred_at": "2026-04-17T15:00:00Z",
        "orderNumber": "MC-260417-A1B2",  # реально существующий
        "carrier": "cdek",
        "trackingNumber": "TEST123",
        "status": {"code": "IN_TRANSIT", "text": "Посылка в пути", "normalized": "in_transit"},
    }
    raw = json.dumps(payload, ensure_ascii=False).encode()
    ts = str(int(time.time()))
    sig = "sha256=" + hmac.new(SECRET.encode(), f"{ts}.".encode() + raw, hashlib.sha256).hexdigest()

    async with aiohttp.ClientSession() as s:
        async with s.post(URL, data=raw, headers={
            "Content-Type": "application/json",
            "X-Millorbot-Timestamp": ts,
            "X-Millorbot-Signature": sig,
        }) as r:
            print(r.status, await r.text())

asyncio.run(main())
```

Ожидаемо:
- `/admin/integrations` увидит запись `inbound` с событием `tracking.updated`.
- `Order.trackingNumber` = "TEST123".
- `Order.carrierStatus` = "Посылка в пути".
- Если статус был `confirmed` или `paid` — сменится в `shipped`, запись в `OrderStatusLog`.
- Уйдёт письмо клиенту «Передан в доставку».

### 4.5 Повторная отправка того же event_id

Выполнить тот же скрипт два раза — второй ответ должен быть `{"ok": true, "idempotent": true}`, никаких повторных писем/логов.

### 4.6 Неправильная подпись

Изменить 1 символ в signature → `401 {"error": "unauthorized", "reason": "bad_signature"}`.

---

## 5. План деплоя (через GitHub)

> **Сторона сайта уже задеплоена на сервер** (см. раздел 0.1). На сервере готово:
> - сеть `millor-backbone`
> - контейнеры `roznica-landing`, `roznica-outbox-worker` в ней
> - миграция Prisma применена (`OutboxEvent`, `IntegrationLog`, `ProcessedInboundEvent`)
> - `MILLORBOT_SHARED_SECRET` в `~/roznica-landing/.env` на сервере
> - флаг `MILLORBOT_ENABLED=false` — worker готов, но пока не стучится
>
> **Остаётся только сторона бота.**

### 5.1 Взять shared secret

```bash
ssh beget 'grep MILLORBOT_SHARED_SECRET ~/roznica-landing/.env'
```
Полученный hex (64 символа) — это будет `WEBSITE_SHARED_SECRET` в `.env` бота.

### 5.2 Деплой бота

```bash
# Локально — завершить работу по плану (шаги 1–9 из раздела 3), потом:
git push origin main

# На сервере:
ssh beget
cd ~/millorbot-delivery
git pull
# Отредактировать .env — добавить/изменить:
#   WEBSITE_API_URL=http://roznica-landing:3000/api/webhooks/millorbot/tracking
#   WEBSITE_SHARED_SECRET=<hex из 5.1>
#   HTTP_SERVER_ENABLED=true
#   HTTP_SERVER_PORT=8000
#   IMAP_ENABLED=true    # оставляем true на переходный период
# Удалить из .env: WEBSITE_AUTH_TOKEN (заменён)
docker compose down
docker compose up -d --build
```

### 5.3 Проверки после запуска бота

```bash
# 1. Бот живёт и сеть подключена
docker logs millor-telegram-router --tail 30
docker network inspect millor-backbone --format '{{range .Containers}}{{.Name}} {{end}}'
# Ожидаемо: millor-telegram-router roznica-landing roznica-outbox-worker

# 2. HTTP-сервер бота отвечает внутри сети
docker exec roznica-landing wget -qO- http://millor-telegram-router:8000/health
# Ожидаемо: {"ok":true}

# 3. HMAC-подпись корректно отвергает невалидный запрос
docker exec roznica-landing wget -qO- --post-data='{}' \
  --header='Content-Type: application/json' \
  http://millor-telegram-router:8000/api/orders/paid 2>&1 || echo "OK — 401 expected"
```

### 5.4 Включение outbox-воркера (это делает Кирилл на сайте)

Когда бот поднят и проверен:
```bash
ssh beget 'cd ~/roznica-landing && sed -i "s/MILLORBOT_ENABLED=false/MILLORBOT_ENABLED=true/" .env && docker compose restart outbox-worker && sleep 3 && docker logs roznica-outbox-worker --tail 5'
```
В логе ожидается `"enabled":true`. После этого накопленные `OutboxEvent` начнут доставляться в бота.

Мониторинг: `https://millor-coffee.ru/admin/integrations`.

### 5.5 Переключение с IMAP на HTTP (после стабилизации)

1. Провести 2–3 реальных тестовых заказа, убедиться что путь работает сквозь HTTP.
2. Проверить `/admin/integrations` — нет failed/dead событий.
3. В `.env` бота: `IMAP_ENABLED=false`, `docker compose restart`.
4. Позже — переключить DNS `millor-shop.ru` на новый сайт, отключить старый WordPress.

---

## 6. Критически важные нюансы (на что налететь проще всего)

1. **Raw body vs. parsed JSON.** Если в `/api/orders/paid` прочитать `await request.json()` до HMAC-verify, подпись НЕ совпадёт (порядок полей, пробелы, unicode-escape). Всегда `await request.read()` первым.

2. **`ensure_ascii=False` при сериализации исходящего.** Иначе русские буквы закодируются как `\u0434...`, и сайт, пересчитывая подпись с другим байтовым представлением, вернёт 401.

3. **Часы.** Контейнеры должны иметь синхронное время (NTP). Отклонение больше 5 минут — сразу 401 `stale_timestamp`.

4. **`processed_events` должна пережить рестарт контейнера.** Убедиться, что SQLite-файл в volume (`./data`).

5. **Идемпотентность в обе стороны.** И бот, и сайт проверяют `event_id`. Повторные вызовы должны быть безопасными.

6. **`TelegramBot.send_to_topic()` без HTML — текст сохранится.** Проверить, что метод умеет работать без `image_path` (передан `None`). Если нет — добавить ветку.

7. **`WEBSITE_API_URL` теперь полный URL (с путём)**, не базовый. Старый код скорее всего делал `url + "/upsert"` — убедиться, что новая версия принимает URL как есть.

8. **Разделить unit-тесты HMAC + integration-тест `/api/orders/paid` с mock router/sheets/bot.** Без тестов это всё будет хрупким.

9. **При ошибке в `handle_order_paid` возвращать 500**, а не 200 — чтобы сайт ретраил. НЕ возвращать 500 на ошибки валидации (400) — это будут бесконечные ретраи.

10. **Размер payload vs. pre-signed body.** aiohttp reads body один раз. Если где-то middleware прочтёт до handler — подпись сломается. На aiohttp-web это обычно не проблема, но для FastAPI с дефолтным middleware надо смотреть.

---

## 7. Чек-лист перед отправкой кода в `main`

- [ ] `src/hmac_util.py` + unit-тесты (`pytest tests/test_hmac.py`)
- [ ] `src/processed_events.py` + миграция `processed_events` в `database.py`
- [ ] `src/http_server.py` с handler `/api/orders/paid` и `/health`
- [ ] `src/main.py` параллельный запуск HTTP-сервера, флаг `IMAP_ENABLED`
- [ ] `src/website_client.py` переписан на HMAC с новым payload
- [ ] `src/status_normalizer.py` + изменения в `scheduler.py`
- [ ] `src/config.py` новые переменные
- [ ] `.env.example` + `docker-compose.yml` (сеть `millor-backbone`, `expose: 8000`)
- [ ] Интеграционный тест: заказ → POST → Telegram + Sheets
- [ ] Интеграционный тест: tracking update → сайт принял, письмо ушло
- [ ] `README.md` обновлён (раздел «Интеграция с сайтом»)

---

## 8. После запуска — наблюдение

Первые 48 часов:
- Смотреть `/admin/integrations` на сайте — outbox не должен копить события, IntegrationLog не должен показывать ошибки.
- `docker logs roznica-outbox-worker -f` — доставка идёт.
- `docker logs millor-telegram-router -f` — запросы приходят, HMAC валидный.
- В Telegram — заказы приходят в правильные топики.
- В Google Sheets — строки добавляются.
- В `Order.trackingNumber` — трек-номера приходят после polling CDEK/Pochta.
- Клиенты получают письма «передан в доставку» / «доставлен».

Если что-то не работает — первым делом проверить:
1. Правильный ли секрет на обеих сторонах.
2. Правильный ли URL бота (resolve внутри docker-сети).
3. Время контейнеров (`docker exec ... date`).
4. Что написано в `last_error` у failed-события в outbox.

---

## 9. Stock events (добавлено 2026-04-20)

Сайт шлёт в millorbot события о критичных изменениях складских остатков.
Используются для того, чтобы менеджеры получали уведомления в Telegram-чат
о закончившихся товарах и могли пополнить склад при следующем привозе.

### Топики

| Topic | Endpoint в боте | Когда срабатывает |
|---|---|---|
| `product.stock.depleted` | `/api/products/stock/depleted` | Переход `stock > 0 → stock == 0` |
| `product.stock.low` | `/api/products/stock/low` | Переход `stock > threshold → stock ≤ threshold` (и `lowStockThreshold != null`) |

### Payload (оба топика идентичны по форме)

```json
{
  "event_id": "stock_depleted_<variantId>_<stockBefore>_to_0",
  "event": "product.stock.depleted",
  "occurred_at": "2026-04-20T13:45:12.000Z",
  "product": {
    "id": "cluxp...xx",
    "name": "Эфиопия Иргачеффе",
    "slug": "ethiopia-yirgacheffe",
    "adminUrl": "https://millor-coffee.ru/admin/products/cluxp...xx"
  },
  "variant": {
    "id": "cluyy...zz",
    "weight": "250г",
    "sku": "ETH-250"
  },
  "stock": {
    "before": 1,
    "after": 0,
    "threshold": null
  }
}
```

### Идемпотентность

`event_id` детерминирован на основе перехода `(variantId, stockBefore, stockAfter)`.
Один и тот же stock-переход всегда даст один `event_id` → на стороне сайта
UNIQUE-констрейнт предотвратит дубли в outbox.

На стороне бота рекомендуется хранить `event_id` в `processed_events` для защиты
от повторной доставки.

### Ожидаемое поведение бота

- Сообщение в Telegram-чат менеджеров формата:
  - `⚠️ Товар закончился: Эфиопия Иргачеффе — 250г. Остаток был 1 → стал 0.`
  - `🔔 Низкий остаток: Эфиопия Иргачеффе — 250г. Осталось 2 (порог: 3).`
- Deep-link на админку через `product.adminUrl` (кнопка-Inline).
- Возможность подтвердить получение («принято, пополним при привозе») —
  опционально, на усмотрение команды бота.

### Ответ бота

Стандартный: `200 { "ok": true, "event_id": "..." }` — сайт пометит событие как `delivered`.
