# Warehouse Management & Delivery Admin Upgrade — план реализации

**Дата создания:** 2026-04-20
**Автор плана:** Claude (по ТЗ владельца магазина Millor Coffee)

---

## 0. Контекст и цели

**Бизнес-задача.** У магазина свежеобжаренного кофе нет корректного учёта склада: менеджер не может оперативно обновить остатки после привоза, товары с нулевым остатком продолжают продаваться, а команда не получает сигнал о том, что продукт закончился. Параллельно — админка доставки после внедрения умной упаковки выросла функционально, но не синхронизирована с реальным потоком: план упаковки нигде не показан, нельзя протестировать тариф из админки, нет видимости в логи интеграций.

**Результат, которого добиваемся.**
1. Менеджер в админке заводит приход и видит текущие остатки по каждому варианту (250 г / 500 г / 1 кг, чаи, растворимка).
2. Заказ автоматически уменьшает остаток; отмена — восстанавливает. Все изменения остатков пишутся в историю с причиной.
3. При падении остатка ниже порога или достижении нуля — уведомление в Telegram-бот (millorbot) менеджерам.
4. Товар с нулевым остатком автоматически не даёт добавить себя в корзину (показывается «Нет в наличии»), без ручного отключения `isActive`.
5. В карточке заказа видна физическая упаковка (S+M+L коробки), можно пересчитать и отредактировать план перед отгрузкой.
6. Админ может протестировать тариф CDEK/Почты прямо из панели, не создавая фиктивный заказ.
7. Виден живой лог интеграций CDEK/Почта/YooKassa/millorbot с фильтром по ошибкам.

---

## 1. Результаты аудита (кратко)

### 1.1 Warehouse — что уже есть
- `ProductVariant.stock Int @default(0)` — поле существует, редактируется в `VariantManager` inline-input.
- Декремент в `lib/dal/orders.ts:168-179` атомарный, в транзакции, с проверкой `stock >= quantity`.
- Клиентская отмена (`cancelOrder()` в `lib/actions/orders.ts:215-290`) корректно восстанавливает stock.
- Фильтр в каталоге — только `isActive: true`; товары с `stock=0` не скрываются.

### 1.2 Warehouse — чего нет (и баги)
- **КРИТБАГ**: `updateOrderStatus()` в `lib/dal/orders.ts:270` при переводе в `cancelled` НЕ восстанавливает stock (клиент отменяет — ок, админ отменяет — stock теряется).
- **КРИТБАГ**: та же функция при переходе `cancelled → pending` не декрементит stock заново.
- Нет поля `lowStockThreshold` в `ProductVariant`.
- Нет таблицы `StockHistory` — неизвестно, кто и когда менял остаток.
- Нет централизованного сервиса `adjustStock(variantId, delta, reason)` — любой код пишет напрямую через Prisma.
- Нет UI для приёма поставки (только inline input).
- Нет колонки «Остаток» и фильтра «Нет в наличии» в списке товаров.
- Нет метрик на главной админки.

### 1.3 Millorbot — что уже есть
- Полноценный outbox (`OutboxEvent` + `scripts/outbox-worker.mjs` + HMAC).
- Хелпер `enqueueOutbox(topic, payload, {eventId})` в `lib/dal/outbox.ts`.
- Топики: `order.paid`, `order.status.changed`.
- Админ-страница `/admin/integrations` с мониторингом и ретраем.

### 1.4 Millorbot — чего нет
- Топики для stock-событий.
- Типы и payload-билдеры для stock в `lib/integrations/millorbot/`.
- Роутинг новых топиков в `outbox-worker.mjs` и в боте.

### 1.5 Admin delivery — что уже есть
- Вкладки: общие, CDEK, Почта, курьер, адреса, наценки — всё редактируется.
- Недавно внедрённый редактор `box_presets` (пресеты коробок S/M/L).
- `DeliveryRulesManager` — условия free/discount/disable.
- Карточка заказа `OrderDeliverySection`: трек, кнопки «Создать отправку» / «Обновить статус».
- `testCdekConnection` — проверка креденшелов.
- `Order.packageWeight` и `Order.packagePlan` уже пишутся при создании заказа.

### 1.6 Admin delivery — чего нет
- `packagePlan` сохраняется, но НЕ отображается в UI заказа.
- Нет тестового калькулятора (вбил город + корзину → получил все тарифы).
- `IntegrationLog` пишется, но не отображается.
- Нет валидации `box_presets` при сохранении (мусорный JSON → фолбэк на дефолты без индикации).
- Нельзя отредактировать пакплан конкретного заказа перед отгрузкой.
- Нет индикатора последнего успешного вызова CDEK/Почты (просрочен ключ — узнаем при создании отправления).

---

## 2. Спринты: высокоуровневое разбиение

| Sprint | Цель | Блокирует | Оценка |
|---|---|---|---|
| **A** | Warehouse core: StockHistory, threshold, safe adjustStock, авто-отключение, UI | — | большой |
| **B** | Bot notifications: outbox-топики для stock, интеграция в adjustStock | A (нужен сервис adjustStock) | средний |
| **C** | Delivery admin upgrade: PackagePlanViewer, test calculator, IntegrationLog viewer | — (параллельно) | средний |
| **D** | Финальный аудит: end-to-end сценарии, edge cases, деплой | A, B, C | средний |

**Рекомендуемый порядок**: A → B последовательно (B зависит от точки «что кинуть событие»), C — параллельно A.

---

## 3. Sprint A — Warehouse Management

### 3.1 Миграции БД

**Файл:** `prisma/schema.prisma`

```prisma
model ProductVariant {
  // ... существующие поля
  lowStockThreshold Int?  // null = не отслеживать; иначе при переходе stock ≤ threshold шлём уведомление
  stockHistory StockHistory[]
}

model StockHistory {
  id           String   @id @default(cuid())
  variantId    String
  variant      ProductVariant @relation(fields: [variantId], references: [id], onDelete: Cascade)
  delta        Int      // +N приход / -N списание
  stockBefore  Int
  stockAfter   Int
  reason       String   // "order_placed" | "order_cancelled" | "order_restored" | "supplier_received" | "inventory_correction" | "write_off"
  orderId      String?  // если связано с заказом
  notes        String?  @db.Text
  changedBy    String?  // AdminUser.id или "customer" / "system"
  createdAt    DateTime @default(now())

  @@index([variantId, createdAt])
  @@index([orderId])
  @@index([reason])
}
```

**Миграция:** `prisma/migrations/20260420_add_stock_history/migration.sql`
- `ALTER TABLE "ProductVariant" ADD COLUMN "lowStockThreshold" INTEGER`
- `CREATE TABLE "StockHistory" (...)` + 3 индекса + FK

### 3.2 Сервис `lib/dal/stock.ts` (новый)

Единая точка изменения остатков. Все кто хочет поменять stock — идут сюда, напрямую через Prisma — запрещено (policy-level, не механически).

```ts
export type StockReason =
  | "order_placed"        // декремент при создании заказа
  | "order_cancelled"     // инкремент при отмене
  | "order_restored"      // декремент при возврате отменённого в работу (cancelled→pending)
  | "supplier_received"   // приход от поставщика (менеджер в админке)
  | "inventory_correction" // ручная коррекция менеджером (исправление ошибки)
  | "write_off"           // списание (брак, потеря)

export interface StockAdjustInput {
  variantId: string
  delta: number            // +N приход, -N списание
  reason: StockReason
  orderId?: string
  notes?: string
  changedBy?: string       // adminId | "customer" | "system"
}

export interface StockAdjustResult {
  variantId: string
  stockBefore: number
  stockAfter: number
  crossedLowThreshold: boolean   // был > threshold, стал ≤
  becameDepleted: boolean        // был > 0, стал 0
  recovered: boolean             // был ≤ 0, стал > 0 (для last-мили-инфо)
}

/**
 * Безопасное изменение остатка. Внутри транзакции:
 * 1. Блокирует строку варианта (SELECT ... FOR UPDATE).
 * 2. Валидирует: если delta < 0, то stock + delta >= 0.
 * 3. Применяет UPDATE stock = stock + delta.
 * 4. Пишет запись в StockHistory.
 * 5. Возвращает маркеры пересечений порогов (для последующих side-effects: уведомления в бот, revalidation каталога).
 *
 * Принимает tx для встраивания в внешнюю транзакцию (заказ + stock + bonuses).
 */
export async function adjustStock(
  input: StockAdjustInput,
  tx?: Prisma.TransactionClient
): Promise<StockAdjustResult>
```

**Для Sprint B** — `crossedLowThreshold` и `becameDepleted` используются для enqueueOutbox уведомлений.

**Важно:** функция чистая — не кидает уведомления сама, не revalidate`ит кэш. Это ответственность вызывающего (чтобы не дублировать события из цепочек заказ → stock → notify).

### 3.3 Рефакторинг потребителей

**`lib/dal/orders.ts`:**

1. `createOrder()` — заменить `$executeRaw UPDATE` на цикл `adjustStock({reason:"order_placed", ...}, tx)` внутри текущей транзакции.
2. `updateOrderStatus()`:
   - При переводе в `cancelled` из любого статуса — для каждого `OrderItem` вызвать `adjustStock({reason:"order_cancelled", delta:+quantity, ...})`.
   - При переводе `cancelled → pending` — декремент `adjustStock({reason:"order_restored", delta:-quantity, ...})`.
   - Wrap всё в транзакцию.
3. `cancelOrder()` (клиентская отмена) — тоже через `adjustStock({reason:"order_cancelled"})`, убрать прямой `stock: {increment}`.

**`lib/actions/products.ts`:**

`updateVariant()` — если `data.stock !== undefined`, вместо прямого UPDATE — `adjustStock({reason:"inventory_correction", delta:newStock-oldStock, changedBy:adminId})`. Причина по умолчанию «inventory_correction», UI должен давать выбрать (см. 3.5).

### 3.4 Auto-disable: скрытие в каталоге

**Задача:** товар с `stock=0` не добавляется в корзину, но остаётся виден как «Нет в наличии».

**Где править:**
1. `lib/dal/products.ts` — в каталоге уже возвращаем `stock`. В карточке на фронте уже есть логика «нет в наличии» для `stock === 0` (проверить `components/sections/Products.tsx`, `components/product/*`).
2. `lib/dal/orders.ts:createOrder()` — atomic `stock >= quantity` защита уже есть, никаких изменений.
3. `/catalog` и `/catalog/[slug]` — если ВСЕ варианты товара `stock=0`, показывать бейдж «Нет в наличии» на карточке; покупка заблокирована. Не скрываем карточку полностью (SEO + будущий возврат).
4. Кнопка «В корзину» должна быть `disabled` для варианта со stock=0.

**Что может сломаться:** избранное, упоминания в корзине, upsell. Если в корзине уже есть 5 шт, а на складе стало 2 — не трогаем корзину, но при чекауте пойдёт валидация в `createOrder()` и пользователь увидит «доступно только 2 шт».

### 3.5 UI — страница `/admin/warehouse`

Новая страница (ни одна существующая не подходит). Компонент `WarehouseDashboard`.

**Структура:**
- **Верх**: метрики (Всего позиций / На нуле / Ниже порога / Без порога).
- **Фильтры**: статус (все / нет в наличии / низкий остаток / в наличии), категория, поиск.
- **Таблица**: Товар | Вариант (250г/1кг/...) | Остаток | Порог | Статус-бейдж | Последнее изменение | Действия.
- **Действие «Быстрый приход»**: inline-кнопка + диалог с полями delta, reason (dropdown), notes. По умолчанию reason=`supplier_received`.
- **Действие «История»**: разворачивающийся блок с последними 20 записями StockHistory для варианта.
- **Массовый ввод**: кнопка «Массовый приход» → таблица со всеми активными вариантами, на каждом `+N`, один submit. Для крупной поставки.

**Файлы:**
- `app/admin/warehouse/page.tsx` — server component, грузит данные через DAL.
- `components/admin/WarehouseDashboard.tsx` — клиентский главный.
- `components/admin/WarehouseStockEditor.tsx` — модалка редактирования остатка.
- `components/admin/BulkStockIntake.tsx` — массовый приход.
- `components/admin/StockHistoryPanel.tsx` — история по варианту.
- `lib/actions/stock.ts` — server actions: `adjustStockAction`, `bulkIntake`, `setLowThreshold`.
- `lib/dal/stock.ts` — сервис adjustStock (3.2), плюс `getStockSnapshot(filters)`, `getStockHistory(variantId)`.

### 3.6 Улучшения существующих страниц

**`app/admin/products/page.tsx`:**
- Колонка «Остаток» (сумма по вариантам + бейдж если 0 или ниже порога).
- Фильтр-чип «Нет в наличии».

**`app/admin/page.tsx`:**
- Карточки: Всего остаток (шт), Нет в наличии (count), Низкий остаток (count), Поставки за 7 дней.

**`components/admin/VariantManager.tsx`:**
- Input stock остаётся, но onBlur вызывает action `adjustStockAction` с reason=`inventory_correction` (не прямой update).
- Показать last changed дату и ссылку «История».
- Добавить поле `lowStockThreshold` рядом со stock.

### 3.7 Edge cases

- **Concurrent orders**: защищает SELECT ... FOR UPDATE внутри транзакции и проверка `stock >= quantity`. Тест: два одновременных checkout'а на последний товар — один пройдёт, второй получит ошибку.
- **Отмена давно отменённого**: transition `cancelled → pending` включён в ALLOWED_TRANSITIONS. Проверить, что stock при повторном inflate есть (может быть проблема, если после отмены добавили товар).
- **Удалённый вариант**: `ProductVariant.orderItems` с `onDelete: SetNull` (вариант удалили, OrderItem остался). При отмене заказа `item.variantId` может быть null — ветку обрабатывать: если null, пропускаем inflate stock (вариант не существует).
- **Negative stock**: `adjustStock` блокирует `newStock < 0`, бросает ошибку. Исключение: «списание брака» допускает force-режим? Пока — нет.

---

## 4. Sprint B — Bot Notifications

### 4.1 Новые топики

| Topic | Когда шлётся | Endpoint в боте |
|---|---|---|
| `product.stock.depleted` | Вариант перешёл `stock > 0 → stock == 0` | `/api/products/stock/depleted` |
| `product.stock.low` | Вариант перешёл `stock > threshold → stock ≤ threshold` (и threshold не null) | `/api/products/stock/low` |

### 4.2 Типы и payload

**`lib/integrations/millorbot/types.ts`:**
```ts
export interface MillorbotStockPayload {
  event_id: string
  event: "product.stock.depleted" | "product.stock.low"
  occurred_at: string
  product: {
    id: string
    name: string
    slug: string
    admin_url: string  // deep link в админку
  }
  variant: {
    id: string
    weight: string   // "250г" / "1кг"
    sku: string | null
  }
  stock: {
    before: number
    after: number
    threshold: number | null
  }
}
```

**`lib/integrations/millorbot/payload.ts`:**
```ts
export function buildStockPayload(
  event: "product.stock.depleted" | "product.stock.low",
  input: { variant: ProductVariant & { product: Product }, stockBefore: number, stockAfter: number, eventId: string }
): MillorbotStockPayload
```

### 4.3 Интеграция в adjustStock

В `lib/dal/stock.ts` функция `adjustStock` возвращает маркеры `becameDepleted` и `crossedLowThreshold`. Вызывающий слой (в `lib/actions/stock.ts`, в `lib/dal/orders.ts`) после успешного commit транзакции вызывает helper:

```ts
// lib/integrations/stock-alerts.ts (новый)
export async function notifyStockChange(result: StockAdjustResult, variant: ProductVariant & { product: Product }) {
  if (result.becameDepleted) {
    const eventId = `stock_depleted_${variant.id}_${result.stockBefore}_to_0`
    await enqueueOutbox("product.stock.depleted", buildStockPayload("product.stock.depleted", {...}), { eventId })
  }
  if (result.crossedLowThreshold && !result.becameDepleted) {
    const eventId = `stock_low_${variant.id}_${result.stockBefore}_to_${result.stockAfter}`
    await enqueueOutbox("product.stock.low", buildStockPayload("product.stock.low", {...}), { eventId })
  }
}
```

**Идемпотентность:** `eventId` включает `stockBefore → stockAfter` — каждый переход уникален. Если заказ оплачен дважды (не должно случаться, но если) — тот же переход даст тот же eventId → UNIQUE violation → пропустим (логика уже есть в `enqueueOutbox` catch P2002).

### 4.4 Routing в worker'е

**`scripts/outbox-worker.mjs`:**
```js
function topicToPath(topic) {
  // ... existing
  if (topic === "product.stock.depleted") return "/api/products/stock/depleted"
  if (topic === "product.stock.low") return "/api/products/stock/low"
  return `/api/${String(topic).replace(/\./g, "/")}`
}
```

### 4.5 На стороне бота

Не трогаем. Отдельная задача для разработки millorbot: принять новые топики, отправить в Telegram-чат менеджеров. Документируем контракт в `docs/millorbot-integration-plan.md` (добавить раздел «Stock events»).

### 4.6 Admin toggle

В `/admin/delivery` (или новый раздел интеграций) — чекбокс «Уведомлять в бот при низком остатке». Пока — управляем через env `MILLORBOT_STOCK_ALERTS_ENABLED`. UI — Phase 2.

---

## 5. Sprint C — Delivery Admin Upgrade

### 5.1 PackagePlanViewer — видимость плана в заказе

**Задача:** в `OrderDeliverySection` показать, как физически упакован заказ.

**Файл:** `components/admin/PackagePlanViewer.tsx` (новый)
```tsx
<PackagePlanViewer plan={order.packagePlan} totalWeight={order.packageWeight} />
```
Отрисует:
```
Упаковка: 2 коробки · брутто 10450 г
  ┌─ S 20×20×20 · 2650 г (ПВЗ)
  └─ L 39×26×21 · 7800 г
```
Цветовая индикация при multi-box (оранжевый бэйдж «N коробок»).

Интегрировать в `OrderDeliverySection.tsx` — в блоке «Доставка» сразу после способа.

### 5.2 Test Calculator — встроенный калькулятор

**Задача:** проверить без создания заказа, сколько стоит доставка Х из СПб в Новосибирск для корзины 2.5 кг.

**Файл:** `components/admin/DeliveryCalculatorTester.tsx` (новый)
- Инпуты: город назначения (autocomplete через `/api/delivery/cities`), список пачек (добавить-удалить с весом и количеством), сумма корзины.
- Кнопка «Рассчитать» → вызывает `calculateDeliveryRates` с этими items.
- Отрисовывает все тарифы: имя, тип, цена (до наценок / с наценками / после правил), min/max дней.
- Бонус: показывает сгенерированный пакплан (использует `buildPackagePlan`).

Добавить новую вкладку «Тестовый расчёт» в `/admin/delivery`.

### 5.3 IntegrationLog Viewer

**Задача:** менеджер видит последние вызовы CDEK/Почты/YooKassa, может диагностировать ошибку.

**Файл:** `components/admin/IntegrationLogViewer.tsx` (новый)
- Таблица: Время, Направление, Источник, Событие, Код, Длительность, Ошибка.
- Фильтры: источник, диапазон дат, только ошибки.
- Клик по строке → раскрыть payload (request + response).

Страница: отдельная вкладка в `/admin/delivery` («Логи») ИЛИ новая `/admin/integrations/logs` (добавляем к существующей `/admin/integrations`).

### 5.4 Валидация box_presets при сохранении

**Файл:** `components/admin/DeliverySettingsForm.tsx`

В `updateBoxPresets` перед вызовом `setLocalSettings` — прогнать валидацию:
- каждая коробка имеет все поля нужных типов
- maxWeightGrams > 0, maxUnits > 0, tareGrams >= 0, L/W/H > 0
- коды пресетов уникальны

При ошибке — блокировать сохранение, показать красную плашку. Использовать `isValidPreset` из `packaging.ts` (экспортировать).

Плюс: после сохранения — тестовый прогон `planPackages([{weightGrams:1000,quantity:1}])` → если падает, показать warning.

### 5.5 PackagePlanEditor (опционально, P1)

Возможность админу пересчитать/отредактировать план упаковки конкретного заказа перед «Создать отправку».

**Сценарий:** заказ имеет packagePlan [L+S], менеджер знает что реально соберёт в одну L. Кликает «Редактировать упаковку», выбирает пресет, сохраняет. Отправка создаётся с новым планом.

**Файлы:**
- `components/admin/PackagePlanEditor.tsx` — диалог с выбором коробок, превьюшка.
- `lib/actions/delivery.ts` → `updateOrderPackagePlan(orderId, plan)` — валидирует, сохраняет, пересчитывает `packageWeight`.

### 5.6 Индикатор статуса credentials

**Цель:** админ видит, когда последний раз успешно обращались к CDEK/Почте, без теста руками.

Запрос в `IntegrationLog`: последний `outbound` с `source in ("cdek","pochta")` и `statusCode IN (200..299)`.

На вкладках CDEK/Почта — плашка «Последний успешный вызов: 5 мин назад» или «Ошибка: 401 Unauthorized, 2 часа назад». Зелёная/красная.

### 5.7 Stats dashboard (P2, отложено)

Отложено до следующего спринта. В текущем — не делаем.

---

## 6. Порядок работ (чек-лист)

### Sprint A — Warehouse
- [ ] A1. Миграция: `lowStockThreshold`, `StockHistory`.
- [ ] A2. `lib/dal/stock.ts`: `adjustStock`, `getStockSnapshot`, `getStockHistory`.
- [ ] A3. `lib/actions/stock.ts`: `adjustStockAction`, `bulkIntakeAction`, `setLowThresholdAction`.
- [ ] A4. Рефактор `lib/dal/orders.ts`: `createOrder`, `updateOrderStatus`, `cancelOrder` → через adjustStock.
- [ ] A5. Рефактор `lib/actions/products.ts`: `updateVariant` через adjustStock.
- [ ] A6. `/admin/warehouse/page.tsx` + компоненты (WarehouseDashboard, WarehouseStockEditor, BulkStockIntake, StockHistoryPanel).
- [ ] A7. `/admin/products/page.tsx`: колонка «Остаток», фильтр.
- [ ] A8. `/admin/page.tsx`: stock-метрики.
- [ ] A9. `components/admin/VariantManager.tsx`: lowStockThreshold поле, ссылка на историю.
- [ ] A10. Каталог: `disabled` кнопки покупки при stock=0, бейдж «Нет в наличии».
- [ ] A11. Unit-ишные проверки race conditions (concurrent orders, cancel+restore).

### Sprint B — Notifications
- [ ] B1. `lib/integrations/millorbot/types.ts`: MillorbotStockPayload.
- [ ] B2. `lib/integrations/millorbot/payload.ts`: buildStockPayload.
- [ ] B3. `lib/integrations/stock-alerts.ts`: notifyStockChange.
- [ ] B4. Вызовы notifyStockChange в adjustStock-consumers (orders, products).
- [ ] B5. `scripts/outbox-worker.mjs`: routing новых топиков.
- [ ] B6. `docs/millorbot-integration-plan.md`: раздел «Stock events» с контрактом.

### Sprint C — Delivery admin
- [ ] C1. `components/admin/PackagePlanViewer.tsx` + интеграция в `OrderDeliverySection.tsx`.
- [ ] C2. `components/admin/DeliveryCalculatorTester.tsx` + вкладка в `/admin/delivery`.
- [ ] C3. `components/admin/IntegrationLogViewer.tsx` + страница/вкладка.
- [ ] C4. Валидация `box_presets` в `DeliverySettingsForm.tsx`.
- [ ] C5. Индикатор последнего успешного вызова CDEK/Почты.
- [ ] C6. (опционально) `PackagePlanEditor.tsx` + `updateOrderPackagePlan` action.

### Sprint D — Аудит + деплой
- [ ] D1. E2E: заказ → stock↓ → уведомление → отмена → stock↑ → уведомление recovered? (последнее не обязательно).
- [ ] D2. Concurrent: два заказа на последний товар — только один проходит.
- [ ] D3. Прогнать реальный CDEK API через тестовый калькулятор, сверить с публичным калькулятором.
- [ ] D4. Проверить, что `Order.packagePlan` корректно отображается в UI.
- [ ] D5. Лог-viewer показывает реальные вызовы.
- [ ] D6. TypeScript + lint + build чистые.
- [ ] D7. Коммит (по одному на спринт), push, deploy через Beget (docker compose build + migrate deploy).

---

## 7. Риски и оговорки

**Риск 1: Breaking change при рефакторе stock-декремента.** Замена `$executeRaw` на `adjustStock` — меняется сигнатура ошибки. Обновить call-sites и покрыть логику.

**Риск 2: eventId для stock-уведомлений на кончике острия.** Если два заказа в короткий промежуток обнулили stock (`stock=2 → 1 → 0`), будут два события с разными eventId — это нормально, бот получит оба, но разумно на стороне бота дедуплицировать по variantId в окне X минут. Документируем в millorbot-integration-plan.md.

**Риск 3: Много новых миграций.** Сейчас база прод-лайв. Миграции применяем через `prisma migrate deploy` в отдельном docker compose run — уже проверенный путь.

**Риск 4: Auto-disable товара при stock=0 может ударить по SEO.** Не скрываем карточку полностью — оставляем видимой с пометкой «Нет в наличии». Это лучше для SEO (страница не 404) и для будущего возврата товара.

**Риск 5: UX масштабного ввода поставки.** Если пресетов 30+ вариантов, ввод в одной форме неудобен. Решение: группировать по продуктам, collapsible. Сделаем в A6.

**Риск 6: У существующих заказов `packagePlan = null`.** PackagePlanViewer должен корректно отрабатывать: показать «план не сохранён» или отстроить из order.items на лету (через `buildPackagePlan`).

---

## 8. Definition of Done

- Менеджер вбивает приход 10× «Эфиопия 250г» в `/admin/warehouse` → в БД инкремент, запись в StockHistory с `reason=supplier_received`, в каталоге товар снова активен.
- Клиент оформляет заказ → stock уменьшается через adjustStock → если дошло до 0, в outbox создаётся `product.stock.depleted`, worker отправляет в бот.
- Админ меняет статус заказа на cancelled → stock инкрементится, StockHistory пополняется, event `product.stock.low` (если он был) не дублируется.
- В карточке заказа `/admin/orders/[id]` виден `PackagePlanViewer` с коробками и весом.
- В `/admin/delivery` → вкладка «Тестовый расчёт»: выбрал Новосибирск + 2×1кг → увидел 6 тарифов, в т.ч. СДЭК Эконом 675 ₽ (совпадение с публичным API).
- В `/admin/delivery` → вкладка «Логи»: видны последние 50 вызовов с фильтром «только ошибки».
- Проверил `npm run build` — сборка без ошибок. Деплой через Beget.
