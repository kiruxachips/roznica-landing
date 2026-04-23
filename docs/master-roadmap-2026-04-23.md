# Master Roadmap — millor-coffee.ru

**Дата:** 2026-04-23
**Статус:** Draft v1 — после 6-потокового аудита
**Автор:** сведено из отчётов explore-агентов (DB, Security, UX/a11y, Admin/Ops, Perf/Observability, Business/Retention)

---

## Зачем этот документ

Сайт технически в хорошем состоянии: checkout-wizard обновлён, outbox-паттерн работает, admin покрывает 85% ops-сценариев, Web Vitals собираются. Но:

1. Фундамент (БД, observability, compliance) имеет дыры, которые дороже становятся чем больше трафика → чинить **раньше** продуктового роста.
2. Несколько реальных багов живут на проде (stock-recovery при отмене, потенциальная утечка данных при cascade-delete пользователя).
3. Growth-фичи (referral, subscription, abandoned cart) не сделаны — это блокирует unit-экономику при масштабировании.

**Правило, по которому составлен план:**

> Любая фича, которая потребует миграции БД или ломает обратную совместимость, идёт ДО фич, которые на неё опираются. Любая фича, которая пишет новые данные (consent, referral, event-log) — после того как схема под неё подготовлена.

---

## Оглавление

- [Часть 0: Текущее состояние](#часть-0-текущее-состояние)
- [Часть 1: P0 — hotfix за эту неделю](#часть-1-p0--hotfix-за-эту-неделю)
- [Часть 2: Фундамент (перед любым ростом)](#часть-2-фундамент-перед-любым-ростом)
- [Часть 3: Growth-спринты (Q2–Q3 2026)](#часть-3-growth-спринты-q2q3-2026)
- [Часть 4: Долгосрочный roadmap](#часть-4-долгосрочный-roadmap)
- [Приложение A: Все находки по агентам](#приложение-a-все-находки-по-агентам)
- [Приложение B: KPI и метрики](#приложение-b-kpi-и-метрики)

---

# Часть 0: Текущее состояние

## Сильные стороны

- **Checkout.** Wizard из 3 шагов, модалка ПВЗ со split-view, persist в sessionStorage, focus-trap, disambiguation одноимённых городов через region+postal_code prefix.
- **Платежи.** ЮKassa через IP-whitelist + HMAC + idempotency, atomic stock-restoration в транзакции.
- **Durable messaging.** Outbox pattern для millorbot с retry + exponential backoff + HMAC. EmailDispatch-таблица с retry/dead-letter и снапшотом HTML.
- **Admin.** 85% операционных сценариев покрыто: orders list+detail с actions, products с coffee-атрибутами, warehouse со StockHistory, reviews moderation, promo-codes, gifts с kill-switch, integration logs.
- **Security базово.** IDOR-защита, CSRF через Server Actions, Prisma (no raw SQL), магические байты при upload, HSTS+CSP, bcrypt rounds=10, email sanitize-html, Telegram HMAC.
- **Web Vitals.** useReportWebVitals → Yandex Metrika.

## Реальные проблемы

| № | Что сломано/отсутствует | Impact | Источник |
|---|---|---|---|
| 1 | `updateOrderStatus` в `cancelled` не восстанавливает stock | Потеря остатков, неправильный учёт | Admin audit |
| 2 | `cancelled → pending` не декрементит stock | Overselling | Admin audit |
| 3 | `BonusTransaction.user` onDelete=Cascade | Удаление юзера стирает финансовую историю → невозможно аудитить баланс | DB audit |
| 4 | Нет `UserConsent` модели + чекбокса с сохранением | 152-ФЗ штраф до 1M₽ | Security audit |
| 5 | Нет `/account/delete` endpoint | 152-ФЗ «право на удаление» | Security audit |
| 6 | Нет health-endpoint `/api/health` | Невозможно мониторить uptime извне | Perf audit |
| 7 | Нет Sentry / structured logging | Ошибки видны только через `docker logs` вручную | Perf audit |
| 8 | Нет cron-backup БД | Единственный бэкап ручной от 2026-04-20 | Perf audit |
| 9 | Order.status/paymentStatus = String, не enum | Race condition на webhook, опечатки проходят в БД | DB audit |
| 10 | Нет `UserConsent` + Referral + Subscription моделей | Блокирует growth-спринты | DB + Business audit |
| 11 | Тестов нет (ни unit, ни E2E) | Каждый рефакторинг = риск регрессии checkout | Perf audit |
| 12 | CI pipeline отсутствует | Нет автоматического lint/build перед деплоем | Perf audit |

---

# Часть 1: P0 — hotfix за эту неделю

Всё, что здесь, ломает пользователя или нарушает compliance прямо сейчас. Скоуп — ≤ 3 дня работы.

## P0-1. Stock-recovery при отмене заказа

**Файл:** `lib/actions/orders.ts` (функции `updateOrderStatus`, `cancelOrder`).

**Что сделать:**
- При переходе `* → cancelled` (кроме уже cancelled) вызвать `adjustStock(..., reason: "order_cancelled")` для каждого `OrderItem`.
- При переходе `cancelled → pending/confirmed/paid` — декрементить снова с `reason: "order_restored"` (если stock недостаточен — блокировать переход с ошибкой).
- Обернуть всё в `prisma.$transaction`, чтобы статус и stock менялись атомарно.

**Acceptance:**
- Unit-тест: отмена заказа с 3 OrderItem возвращает 3 записи в StockHistory с `reason=order_cancelled`.
- Ручной тест: создать заказ → cancelled → статус товара в /admin/warehouse показывает восстановленный stock.

## P0-2. P0-bug: BonusTransaction cascade

**Файл:** `prisma/schema.prisma` (L≈?, строка `user User @relation(..., onDelete: Cascade)` в модели `BonusTransaction`).

**Что сделать:** Cascade → SetNull. Миграция: добавить колонку `userId` → nullable; не дропать существующие записи.

**Acceptance:** удаление тестового User не трогает `BonusTransaction.amount` (строки остаются с `userId = null`).

## P0-3. Health-endpoint + monitoring outside

**Новый файл:** `app/api/health/route.ts`.

```ts
// Псевдокод:
// - Check DB: await prisma.$queryRaw`SELECT 1`
// - Check SMTP: (optional, expensive) — не делаем в каждом запросе
// - Return { status: "ok", db: "ok", uptime: process.uptime() }
// - Код 200 если всё ОК, 503 если что-то не так
```

**Запустить:** UptimeRobot (бесплатный tier) на `/api/health` с 5-минутным интервалом. Уведомление в Telegram-канал админов на downtime.

**Acceptance:** GET `/api/health` возвращает JSON со статусом, 503 если БД недоступна.

## P0-4. Backup cron

**Новый файл:** `scripts/backup.sh`, cron на сервере.

```bash
# Псевдокод:
# pg_dump -Fc -U $POSTGRES_USER -d $POSTGRES_DB > /backups/db_$(date +%Y%m%d_%H%M%S).dump
# Ротация: оставлять последние 7 дней + 4 еженедельных снапшота
# Upload в S3-совместимое хранилище (Yandex Object Storage, Selectel)
```

**Acceptance:**
- Бэкап создаётся каждые 24 часа, видно в `ls /backups/`.
- Один раз в месяц — ручной restore в staging-БД с verification что `SELECT COUNT(*) FROM "Order"` совпадает.

## P0-5. Sentry + structured errors

Добавить `@sentry/nextjs`. Инициализация в `sentry.client.config.ts` и `sentry.server.config.ts`. Free tier = 5k events/month хватит.

**Acceptance:** искусственный `throw new Error("sentry-test")` в test-endpoint → видим событие в Sentry dashboard в течение минуты.

## P0-6. Эстетика индикатора шагов и модалки ПВЗ (уже сделано)

*Done в предыдущем спринте, галочка для полноты.*

---

**Сводный acceptance Phase-0:**

- Ни один баг из Часть 0 пункт 1, 2, 3, 6, 7, 8 не воспроизводится на staging.
- Health-check ping приходит в Telegram-канал админов зелёным.

---

# Часть 2: Фундамент (перед любым ростом)

**Цель:** сделать базу такой, чтобы growth-фичи можно было класть сверху без миграций данных и переписывания API.

**Принцип:** не оптимизируем под hypothetical 10x трафика, но **не закладываем долг**, который станет болезненным на 3x.

## Спринт F1: Типизация статусов и schema hygiene (5–7 дней)

### F1-1. Prisma enums для статусов
Превратить все статус-поля из `String` в `enum`:
- `OrderStatus`: PENDING, PAID, CONFIRMED, SHIPPED, DELIVERED, CANCELLED, RETURNED
- `PaymentStatus`: PENDING, SUCCEEDED, CANCELLED, REFUNDED
- `EmailDispatchStatus`: PENDING, SENT, FAILED, DEAD
- `AdminRole`: ADMIN, MANAGER
- `StockReason`: ORDER_PLACED, ORDER_CANCELLED, ORDER_RESTORED, SUPPLIER_RECEIVED, INVENTORY_CORRECTION, WRITE_OFF, GIFTED, GIFT_RETURNED, SHRINKAGE

**Миграционная стратегия:**
1. Деплой 1: добавить новые enum-поля рядом со старыми (dual-write). Код пишет в оба.
2. Backfill-скрипт: сопоставить старые string-значения с enum.
3. Деплой 2: переключить чтение на новые поля.
4. Деплой 3: дропнуть старые поля.

### F1-2. Soft-delete
Добавить `deletedAt: DateTime?` на `User`, `Product` (уже есть isActive, оставить как operational flag + deletedAt как permanent).
- DAL-методы: по умолчанию `where: { deletedAt: null }`.
- Admin UI: показывать archived за отдельным фильтром.

### F1-3. onDelete policies — ревизия всех FK
Критически опасные:
- `BonusTransaction.user` → SetNull (фикс P0-2 расширение)
- `Account.user` → SetNull + добавить `LoginHistory` таблицу для аудита
- `Address.user` → SetNull
- `Session.user` → SetNull
- `StockHistory.variant` → Restrict (нельзя удалять variant если есть история)
- `OrderStatusLog.order` → Restrict (историю статусов тоже сохраняем)

### F1-4. Идемпотентность на денежных операциях
- `BonusTransaction.idempotencyKey: String? @unique`
- `EmailDispatch` уже имеет уникальный ключ `(orderId, kind, recipient, status="SENT")` — убедиться через миграцию.
- Все server actions, начисляющие бонусы/списывающие со склада, должны принимать optional idempotencyKey.

### F1-5. Compound indexes для hot-path запросов
По списку DB-аудита добавить:
- `Order @@index([userId, status, createdAt])`
- `BonusTransaction @@index([userId, type, createdAt])`
- `EmailDispatch @@index([kind, status, createdAt])`
- `VerificationCode @@index([email, expiresAt])`
- `AdminActivityLog @@index([action, entityType, createdAt])`
- `ProcessedInboundEvent @@index([source, createdAt])`

**Acceptance для всего F1:**
- Prisma schema содержит enum'ы, deletedAt, новые indexes.
- CI прогоняет `prisma migrate diff` против прода — нет dangling drift.
- Backfill-скрипты идемпотентны, документированы в `prisma/migrations/README.md`.

---

## Спринт F2: Compliance (152-ФЗ) — 3–4 дня

### F2-1. UserConsent модель + чекбокс на checkout и регистрации

```prisma
model UserConsent {
  id         String   @id @default(cuid())
  userId     String?
  user       User?    @relation(..., onDelete: SetNull)
  type       ConsentType
  version    Int      // версия текста оферты на момент согласия
  acceptedAt DateTime @default(now())
  revokedAt  DateTime?
  ipAddress  String?
  userAgent  String?
  orderId    String?  // если согласие было дано при оформлении заказа
  @@index([userId, type])
}

enum ConsentType { PRIVACY MARKETING COOKIES }
```

- Checkbox в `PaymentStep.tsx` (агрегированный agreed уже есть) сохраняет запись в `UserConsent` при submit.
- При регистрации — отдельный запрос.
- При изменении текста `/privacy` — инкрементим version. Юзеры с старой версией видят баннер «оферта обновлена, подтвердите».

### F2-2. Account deletion
Новый endpoint `/api/account/delete` + UI на `/account/settings`:
- Двухшаговое подтверждение: кнопка → подтверждение по email (6-значный код).
- Анонимизация: User.email → `deleted-{id}@anon.local`, User.name → "Удалённый пользователь", deletedAt = now.
- Заказы и BonusTransaction остаются с `userId` → все связаны по deleted-anonymized User, или `userId = null` (в зависимости от P0-2 фикса).

### F2-3. Data export
Endpoint `/api/account/export-data` → JSON файл с заказами, адресами, отзывами, бонусной историей.

**Acceptance:** Юзер может скачать свои данные, удалить аккаунт. После удаления логин невозможен, данные анонимизированы, заказы остались для бухучёта.

---

## Спринт F3: Observability и CI (4–5 дней)

### F3-1. Structured logger
Pino (JSON-stdout) с level и context. Обернуть все `console.error` в `lib/actions/*`, `lib/email.ts`, `app/api/**/route.ts`.

### F3-2. GitHub Actions CI
`.github/workflows/ci.yml`:
- на push/PR: `npm ci && npm run lint && npm run build && npm run typecheck`
- на merge в main: + optional `npm run test`

### F3-3. Vitest setup + smoke-tests
Минимальный набор:
- `lib/actions/orders.test.ts`: создание заказа, отмена, восстановление.
- `lib/delivery/overpass.test.ts`: disambiguation городов через mocked fetch.
- `lib/recommendations.test.ts`: cross-sell scoring.

### F3-4. Circuit breaker для СДЭК
`lib/delivery/cdek.ts`: если 5 подряд 5xx/timeout за 60 сек — открываем circuit на 5 минут, возвращаем 503 от нашего API без похода во внешний.

### F3-5. Dependabot
`.github/dependabot.yml` для npm еженедельно.

**Acceptance:** CI зелёный на main. PR ломающий типы не мерджится. При падении СДЭК checkout возвращает «временно недоступно», а не таймаутит 10 секунд.

---

## Спринт F4: Performance quick-wins (3–4 дня)

### F4-1. DAL в unstable_cache
- `getProducts`, `getCategories`, `getFeaturedProducts`, `getCollections` — обернуть в `unstable_cache(..., { revalidate: 60, tags: [...] })`.
- Теги уже есть в `lib/cache-tags.ts`. При изменении товара в admin — `revalidateTag("products")`.

### F4-2. Review aggregate в SQL
`lib/dal/products.ts`: заменить `reviews: { select: { rating } }` на `_count: { reviews: true }` + SQL `AVG(rating)` через raw или дополнительное поле в БД.

Либо (лучше): добавить `Product.avgRating` и `Product.reviewCount` денормализованные поля, обновлять через Prisma middleware или cron.

### F4-3. PgBouncer / Prisma pool config
`DATABASE_URL?connection_limit=10&pool_timeout=20&connect_timeout=10`. Поставить PgBouncer на сервере beget (transaction-mode).

### F4-4. Sharp resize при upload
`lib/actions/images.ts`: перед сохранением — `sharp(buffer).resize({ width: 1600 }).webp({ quality: 85 }).toBuffer()`. Хранить original + thumb варианты.

**Acceptance:**
- Lighthouse mobile `/` и `/catalog` — LCP < 2.5s, CLS < 0.1.
- DB connection count в пике запросов не выше 20.

---

# Часть 3: Growth-спринты (Q2–Q3 2026)

Все спринты ниже **опираются на готовый фундамент** Части 2. Не начинаем пока не закрыты F1 и F2.

## Спринт G1: First-order discount + Email newsletter (1 неделя)

### G1-1. Welcome discount
- Добавить `User.firstOrderCompletedAt: DateTime?`
- В checkout: если null и нет промокода — автопримененить `first_order_percent_discount` setting (default 10%).
- На UI: plashka «−10% на первый заказ» в sidebar-summary.

### G1-2. Newsletter subscribers
```prisma
model NewsletterSubscriber {
  id String @id
  email String @unique
  status NewsletterStatus @default(ACTIVE)  // enum
  subscriptionGroups String[]  // ["promotions", "new_products", "weekly_digest"]
  createdAt DateTime @default(now())
  unsubscribedAt DateTime?
  unsubscribeToken String @unique
}
```
- Форма в footer: email → создаёт subscriber.
- Unsubscribe link `/email/unsubscribe?token=xxx` — one-click, сохраняем revokedAt.

### G1-3. Newsletter campaigns (admin)
`/admin/newsletters`:
- Список campaigns, создание новой.
- Выбор segment (all / promotions group / specific product).
- Предпросмотр → отправка батчем через EmailDispatch (уже есть retry).
- Metrics: opened/clicked — trackers в email-письме.

**Acceptance:** Создать campaign → отправить 10 тестовым → увидеть open rate в admin.

---

## Спринт G2: Referral program (1–1.5 недели)

```prisma
model ReferralCode {
  id String @id
  userId String
  user User @relation(..., onDelete: Cascade)
  code String @unique  // short human-readable, e.g. "ANNA5K"
  usageCount Int @default(0)
  totalRewardEarned Int @default(0)  // в бонусах
  createdAt DateTime @default(now())
  expiresAt DateTime?
}

model ReferralRedemption {
  id String @id
  referralCodeId String
  referralCode ReferralCode @relation(...)
  referredUserId String  // новый юзер кто перешёл
  orderId String  // первый оплаченный заказ (trigger для reward)
  referrerReward Int  // ₽ в бонусах (inviter)
  referredReward Int  // ₽ в бонусах (invitee)
  createdAt DateTime @default(now())
}
```

**Flow:**
1. `/account/referrals` показывает код + ссылку: `https://millor-coffee.ru/?ref=CODE`
2. Landing запоминает `ref` в cookie на 30 дней.
3. При регистрации / первом заказе — создаём `ReferralRedemption`, начисляем бонусы обоим через `BonusTransaction`.

**Acceptance:**
- Регистрация с `?ref=CODE` создаёт redemption после первого заказа.
- Admin может снять reward через `/admin/customers/[id]` (когда появится).

---

## Спринт G3: Abandoned cart recovery (4–5 дней)

### G3-1. Track abandoned carts
- Зарегистрированные: `CartSnapshot { userId, items JSON, updatedAt }` — обновляется каждые ~60 сек активности.
- Гости: по email-привязке на checkout step1 — если email введён, сохраняем снапшот.

### G3-2. Cron `/api/cron/abandoned-cart`
Каждые 30 минут: ищет snapshots с `updatedAt > 1h ago` и без заказа после snapshot → кидает `EmailDispatch(kind="cart.abandoned")` с ссылкой на восстановление + персональный одноразовый промокод −5%.

### G3-3. Восстановление
`/cart/restore?token=xxx` — подтверждает token, добавляет items в Zustand, редиректит на `/cart`.

**Acceptance:** положил 2 товара → закрыл → через час пришло письмо. Клик → корзина восстановлена со промокодом применённым.

---

## Спринт G4: Subscription (регулярная доставка) (1.5–2 недели)

```prisma
model Subscription {
  id String @id
  userId String
  user User @relation(...)
  variantId String
  variant ProductVariant @relation(...)
  quantity Int
  intervalDays Int  // 14, 30
  status SubscriptionStatus @default(ACTIVE)  // ACTIVE | PAUSED | CANCELLED
  nextDeliveryDate DateTime
  deliveryAddressSnapshot Json  // frozen at creation
  discountPercent Int @default(5)  // скидка за подписку
  lastOrderId String?
  createdAt DateTime @default(now())
  cancelledAt DateTime?
}
```

**Flow:**
- Checkout: галочка «Доставлять каждые X дней со скидкой Y%».
- Cron `/api/cron/subscriptions-create-orders` ежедневно:
  - Находит `nextDeliveryDate <= today AND status=ACTIVE`.
  - Создаёт новый Order через server action (переиспользуя createOrder), помечая `fromSubscriptionId`.
  - Обновляет `nextDeliveryDate += intervalDays`.
- `/account/subscriptions` — управление: пауза до даты, отмена, смена адреса/частоты.

**Важно:** subscription создаёт заказы **без** платежа ЮKassa автоматически (мы не сохраняем PAN). Подход: созданный заказ уходит в статус PENDING + отправляется письмо клиенту со ссылкой на оплату. Альтернатива — рекуррентные платежи ЮKassa (требуют отдельного договора).

**Acceptance:** Подписка на 2 недели → через 14 дней создаётся новый Order в статусе PENDING, клиенту уходит email со ссылкой.

---

## Спринт G5: Premium coffee attributes (2–3 дня)

Добавить в Product:
- `elevation: Int?` (м над уровнем моря)
- `harvestDate: DateTime?`
- `roastDate: DateTime?` (видится как «Обжарено N дней назад» на карточке)
- `batchId: String?`
- `tasterNotes: String?` (от куппера, отдельно от `flavorNotes`)
- `cupper: String?`

UI: на `/catalog/[slug]` блок «Паспорт зерна» с иконками.

**Acceptance:** Admin может заполнить все поля в `/admin/products/[id]`. На карточке товара отображается «Обжарено 3 дня назад, высота 1800м, партия N».

---

## Спринт G6: Customer CRM в admin (1 неделя)

`/admin/customers`:
- Список: имя, email, дата регистрации, заказов, LTV, статус (active/blocked).
- Фильтры: registered/guest, lifetime > 10k, давно не покупал.
- Поиск.

`/admin/customers/[id]`:
- Профиль + адреса + subscriptions + referral code + бонусный баланс с историей.
- Actions: заблокировать, выдать бонусы вручную (причина обязательна → AdminActivityLog), отправить письмо.
- История всех заказов.

**Acceptance:** Admin может найти клиента по email, увидеть все заказы, выдать 500 бонусов с причиной «компенсация за задержку» — это попадает в AdminActivityLog и BonusTransaction с `type=admin_adjustment`.

---

## Спринт G7: Reviews 2.0 + email prompt (4–5 дней)

### G7-1. Extended Review model
```prisma
model Review {
  // existing fields
  userId String?
  user User? @relation(..., onDelete: SetNull)
  orderId String?  // для verified-purchase
  verifiedPurchase Boolean @default(false)
  helpful Int @default(0)
  unhelpful Int @default(0)
  sellerResponse String? @db.Text
  respondedAt DateTime?
  status ReviewStatus @default(PENDING)  // PENDING | APPROVED | REJECTED
  rejectionReason String?
  media ReviewMedia[]
}

model ReviewMedia {
  id String @id
  reviewId String
  review Review @relation(...)
  type MediaType  // IMAGE | VIDEO
  url String
  createdAt DateTime
}
```

### G7-2. Email prompt cron
Через 7 дней после `DELIVERED` — `EmailDispatch(kind="review.request")` с глубокой ссылкой на форму + обещание +100 бонусов за отзыв.

### G7-3. Admin moderation улучшить
`/admin/reviews`:
- Фильтр по status, rating, verified.
- Bulk approve/reject.
- Response form для admin (responded to by admin shown on site).

**Acceptance:** Доставленный заказ через 7 дней → письмо. Клиент оставляет отзыв с фото → попадает в PENDING → admin approves → отображается на продукте.

---

## Спринт G8: Frequently Bought Together + sticky mobile CTA + bottom nav (3–4 дня)

### G8-1. FBT recommendations
- Новый DAL `getFrequentlyBoughtTogether(productId)`: SQL агрегация по OrderItem — top-3 товара, которые часто идут в одной корзине с данным.
- Кэш на 1 час.
- Блок на `/catalog/[slug]` после related products.

### G8-2. Sticky mobile CTA на product page
`components/product/StickyAddToCart.tsx` уже есть — убедиться что работает, добавить aria-label, focus ring.

### G8-3. Bottom navigation на mobile
`components/layout/BottomNav.tsx`: 4 иконки (главная / каталог / корзина с badge / аккаунт). z-index 40, safe-area-inset-bottom.

**Acceptance:** На mobile на всех страницах кроме checkout виден bottom-nav. На product scroll вниз — sticky add-to-cart появляется.

---

# Часть 4: Долгосрочный roadmap (Q4 2026+)

## H1: Event-sourcing для Order lifecycle
Создать `OrderEvent` append-only таблицу. Все изменения Order (status, stock, payment, bonus) сначала пишутся как event, потом worker применяет. Replay для reliability, audit trail для disputes.

**Эффект:** consistent state в distributed системе, восстановление после сбоев, compliance audit.

## H2: Full-text search
Postgres `tsvector` колонка на Product, GIN-индекс, `to_tsquery('russian', ...)` в DAL. Альтернатива — MeiliSearch/Elasticsearch если каталог > 500.

## H3: Gift cards
Отдельный товар-GiftCard с генерацией уникального кода, балансом. Применение в checkout как частичная оплата.

## H4: B2B / оптовые цены
`WholesaleAccount { companyName, discountTier }`. Tier-based pricing в `ProductVariant.wholesalePrices: Json`. Отдельный checkout-flow.

## H5: PWA с push-уведомлениями
Service worker, manifest уже есть. Push через FCM на статусы заказа. Install prompt на 2-й визит.

## H6: Analytics dashboard
`/admin/analytics`:
- Revenue по дням (график).
- Воронка: landing → product view → add_to_cart → begin_checkout → purchase.
- Cohort retention (% юзеров, купивших повторно через N дней).
- Top products, ARPU, LTV.

## H7: 2FA для admin + ротация секретов
TOTP через `otplib`. Bitwarden/Vault для ротации API keys (СДЭК, ЮKassa) раз в 90 дней.

## H8: Load-testing + horizontal scale prep
`k6` сценарии: 100 RPS на checkout. Если single-instance не держит — переход на Redis для rate-limit, 2+ инстанса app за nginx, sticky sessions.

---

# Приложение A: Все находки по агентам

## A.1 DB / Prisma schema (агент #1)

**Critical:**
- Order/Payment/EmailDispatch status = String, не enum → [Спринт F1-1]
- Нет soft-delete deletedAt → [Спринт F1-2]
- BonusTransaction Cascade при User delete → финансовая data loss → [P0-2 + F1-3]

**Major (missing models):**
- NewsletterSubscriber → [Спринт G1-2]
- Review с userId, media, verified, moderation → [Спринт G7-1]
- Wishlist sharing, ProductComparison → [Часть 4 / backlog]
- ReferralCode, LoyaltyTier, BonusExpiration → [Спринт G2]
- GiftCard → [Часть 4 H3]

**Major (missing fields):**
- Product: elevation, harvestDate, roastDate, batchId, tasterNotes, cupper → [Спринт G5]

**Index gaps:** все в [F1-5].

**Hygiene:**
- Missing compound unique constraints на BonusTransaction.idempotencyKey → [F1-4]
- Inconsistent onDelete policies → [F1-3]

**Future:**
- Event-sourcing OrderEvent → [H1]
- Структурированные модели вместо JSON (`deliveryAddress`, `packagePlan`) → [H1+]
- Full-text search tsvector/GIN → [H2]
- Rate-limit/fraud-detection models (при scale) → [H8]
- Price history → [backlog]

## A.2 Security (агент #2)

**Критично пересмотренные (агент завысил severity):**
- ~~CRITICAL: OAuth токен в логах~~ — проверил: `Boolean(tokens.id_token)` не утекает значение, только наличие. **Считаем LOW**, но стоит убрать сам объект `tokens` из `console.error` на всякий случай → [F3-1 structured logger]
- ~~CRITICAL: in-memory rate-limit~~ — на single-instance работает корректно, riск при scale. **MEDIUM, не CRITICAL** → [H8]

**Реальные CRITICAL:**
- Payment amount tolerance = 1₽ — при больших чеках +/-1₽ это 0.02%, но проще переделать на процент или нормальный round → [F1 hygiene micro-task]

**HIGH:**
- Phone validation уязвима к null-byte → [F1 micro-task: strict regex до replace]
- OAuth APIs без timeout → [F3-4 circuit breaker + timeout everywhere]
- 152-ФЗ consent → [Спринт F2-1]
- Account deletion → [Спринт F2-2]
- OAuth state в cookie vs session store → [Backlog, low exploit probability т.к. PKCE]

**MEDIUM:**
- Admin password policy слабая → [F2 micro: 12+ symbols + complexity]
- Нет 2FA для admin → [H7]
- Email enumeration timing → [косметика, LOW]
- Code entropy 6-digit → [проверили: с rate-limit 10/час это 114 лет на брут, OK-as-is]
- ProcessedInboundEvent без TTL → [F1 micro: cron cleanup]
- Email в логах → [F3-1 добавить masking в logger]
- VK callback RL по IP → [F3 tune]

**LOW:**
- CSP unsafe-inline → [Backlog, defense-in-depth]
- HSTS 2 years → [косметика]
- Dependabot → [F3-5]

## A.3 UX/a11y (агент #3)

**Quick wins (Часть 2 F4 + Часть 3 G1/G5):**
- Skip-to-main link → [G8 полиш]
- Контраст text-muted-foreground → [G8 полиш]
- Reorder button → уже есть (ReorderButton компонент)
- Debounce в CartDrawer → [G8 полиш]
- Нормализованная цена 100г на карточке → [G5]

**Medium:**
- WeightSelector цена за 100г → [G5]
- Дата доставки на thank-you → [G8 полиш]
- Bottom nav mobile → [G8]
- Frequently Bought Together → [G8-1]
- Express delivery option → [Backlog]
- Cart Upsell tier-aware → [Backlog]

**Big:**
- Расширенные фильтры каталога (processing, price slider, tasting) → [G5 + отдельный спринт G9]
- `export const revalidate` вместо force-dynamic для /catalog/[slug] → [F4-1]
- Bottom navigation mobile → [G8-3]
- RSS + related articles blog → [H6 content]

**Research:**
- CTA wording A/B, haptic feedback, live social proof counter — отложены до настройки feature flags / A/B infra.

## A.4 Admin (агент #4)

**Missing-Critical:**
- /admin/customers → [Спринт G6]
- /admin/analytics → [H6]
- Stock-recovery баги → [P0-1]

**Missing-Nice:**
- Bulk операции для orders (batch СДЭК-отправка) → [Backlog, после G6]
- Экспорт CSV orders → [Backlog]
- Dashboard графики → [H6]
- Уведомления admin на новый заказ (Telegram) → уже есть outbox-топики, добавить notification flow → [G6 bonus]
- Фильтры orders по дате/сумме/городу → [G6 bonus]

**Missing-Weak:**
- PackagePlanViewer UI → [Backlog, admin polish]
- Low threshold UI для variants → [Backlog]
- Price history товара → [Backlog]

## A.5 Perf/Observability (агент #5)

**Critical-gaps:**
- Sentry → [P0-5]
- Health endpoint → [P0-3]
- DB backups → [P0-4]
- Structured logging → [F3-1]
- Email monitoring dashboard → уже есть /admin/email-dispatch, добавить алерты → [F3 bonus]
- DB connection pooling → [F4-3]

**Perf:**
- N+1 reviews в каталоге → [F4-2]
- unstable_cache на DAL → [F4-1]
- Yandex Maps DNS prefetch на layout → [Backlog low-priority]
- force-dynamic на catalog/[slug] → [F4-1]

**Infra:**
- CI pipeline → [F3-2]
- Unit tests → [F3-3]
- Docker healthcheck в Dockerfile → [F3 polish]
- outbox-worker healthcheck → [F3 polish]
- Circuit breaker CDEK → [F3-4]
- .dockerignore полный → [F3 polish]
- pm2.config.js → [F3 polish]

**Future-scale:**
- Redis для rate-limit + cache → [H8]
- CDN Cloudflare для uploads → [H8]
- Read-replica для analytics → [H8]

## A.6 Business / retention (агент #6)

**P0 growth:**
- First-order discount → [G1-1]
- Newsletter subscribe форма + campaigns → [G1-2, G1-3]
- Abandoned cart recovery → [G3]

**P1 growth:**
- Referral program → [G2]
- Subscription (регулярная доставка) → [G4]
- Premium coffee attributes → [G5]
- Review email prompt → [G7-2]
- Free delivery progress bar UI polish → [G8]

**P2 (long-term):**
- PWA/push → [H5]
- Landing pages long-tail SEO → [H6 content]
- Gift cards → [H3]
- B2B → [H4]

**P3 (polish):**
- Urgency timers → [Backlog]
- Live purchase counter → [Backlog, нужен feature-flag]
- Chat widget → [Backlog]

---

# Приложение B: KPI и метрики

## До запуска каждого спринта — baseline:

- **Conversion rate** (purchase / session)
- **Checkout abandonment rate** (begin_checkout → purchase)
- **AOV** (average order value)
- **Mobile conversion rate**
- **Return customer rate** (%)
- **LTV / CAC ratio**
- **Email open rate / click rate**
- **Review rate** (reviews / delivered orders)

## Целевые метрики по фазам:

| Спринт | KPI | Цель |
|---|---|---|
| P0 | Uptime (Sentry error rate) | 99.9%+ |
| F1 | Zero data inconsistencies в Order status | 100% |
| F2 | 152-ФЗ audit passed | ✓ |
| F3 | CI catches regressions | — |
| F4 | Lighthouse mobile LCP | < 2.5s |
| G1 | First order discount uptake | 40%+ |
| G2 | Referral redemptions / month | 5%+ of new users |
| G3 | Abandoned cart recovery rate | 8–12% |
| G4 | Subscription retention (3 мес) | 40%+ |
| G5 | AOV uplift в premium сегменте | +15% |
| G6 | Admin time per order | −30% |
| G7 | Review rate | 8%+ |
| G8 | Mobile conversion | +15% |

## Monitoring stack:
- Sentry — errors (free tier, 5k events/mo)
- UptimeRobot — `/api/health` (free, 5-min interval)
- Yandex.Metrika — Web Vitals + события воронки
- Google Search Console — SEO-позиции
- Admin-dashboard в самой админке — бизнес-метрики (после H6)

---

# Принципы реализации

1. **Феч-паттерн:** каждый PR ≤ 300 строк изменений (кроме init-спринтов F1). Лучше 3 последовательных PR чем 1 огромный.
2. **Миграции:** добавлять колонки → код умеет в dual-write → backfill → переключить read → дропнуть старое. Никогда не дропаем колонку в том же деплое что добавляем.
3. **Server actions:** всегда через Zod-схему, всегда через `auth()` guard.
4. **Любой новый внешний API:** таймаут + retry с backoff + circuit breaker с пунктом в `/admin/integrations`.
5. **Любая денежная операция:** в транзакции + idempotency key + лог в AdminActivityLog/StockHistory/BonusTransaction.
6. **Любой новый email-триггер:** через EmailDispatch (retry + dead-letter), не через прямой SMTP.
7. **Любая новая user-facing форма:** a11y-чеклист (label, focus ring, error-message, aria-live), работает с клавиатуры.
8. **Код комментарии:** только когда объясняем WHY, не WHAT. См. CLAUDE.md.

---

# Total effort estimation

| Часть | Дней работы | Параллелизм |
|---|---|---|
| P0 hotfix | 3 | соло |
| F1 schema hygiene | 5–7 | соло |
| F2 compliance | 3–4 | параллелить с F1 после schema готова |
| F3 observability+CI | 4–5 | параллелить с F1/F2 |
| F4 perf quick-wins | 3–4 | параллелить с F3 |
| G1 discount+newsletter | 5–7 | соло |
| G2 referral | 7–10 | соло |
| G3 abandoned cart | 4–5 | параллелить с G2 |
| G4 subscription | 10–14 | соло |
| G5 premium attrs | 2–3 | параллелить с любым |
| G6 customer CRM | 5–7 | соло |
| G7 reviews 2.0 | 4–5 | параллелить с G6 |
| G8 FBT + bottom nav | 3–4 | параллелить с чем угодно |

**Total (P0 + F1–F4):** ≈ 18–25 рабочих дней одного человека = 1 месяц с буфером.
**Total (G1–G8):** ≈ 40–55 дней = 2–3 месяца при последовательной работе.

---

*Конец документа. Обновляется по мере реализации спринтов — ставить `✓` рядом с закрытыми пунктами и коммит-хеш.*
