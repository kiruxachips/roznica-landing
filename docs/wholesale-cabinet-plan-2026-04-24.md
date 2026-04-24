# Кабинет оптовика — Master-план реализации (2026-04-24)

> **Статус:** утверждён к реализации. Подход — без быстрых компромиссов, сразу «по уму» на будущее.
>
> **Scope:** полноценный B2B-кабинет внутри существующего Next.js приложения + расширение админки + события в Millorbot. Отдельное приложение/монорепо **не** создаём (обоснование ниже).
>
> **Sprint 1 (этот):** Фазы 0-4 — архитектура, auth, каталог, корзина, оформление, админ-вкладка «Оптовики», события в бот. Всё через миграции и новый код, без поломок розницы.
>
> **Будущие спринты:** Фазы 5-8 — документооборот, кредит-менеджмент, multi-user аккаунты, саморегистрация через DaData-верификацию.

---

## 0. TL;DR

1. **Архитектурно:** `/wholesale/*` как третья вертикаль поверх существующего Next.js, наряду с `/account/*` (розница) и `/admin/*` (админка).
2. **Новые модели:** `WholesaleCompany`, `WholesaleUser`, `WholesaleAccessRequest`, `PriceList`, `PriceListItem`, `WholesaleCreditTransaction`, `WholesaleDocument`. Расширение `Order` полями `channel`, `wholesaleCompanyId`, `paymentTerms`.
3. **Принцип pricing:** цены оптовика вычисляются **только в DAL** через функцию `resolvePrice(variantId, ctx)`. Никогда на клиенте, никогда в общих компонентах. Никогда не возвращается оптовая цена без `ctx.wholesale=true`.
4. **Auth:** третий `userType="wholesale"` с отдельной таблицей `WholesaleUser`, отдельный провайдер `wholesale-credentials`, расширение `middleware.ts` и `lib/permissions.ts`.
5. **Admin RBAC:** новая доменная группа permissions `wholesale.*` — admin видит всё, manager — операции (просмотр компаний, заказов, прайс-листов), ключевые действия (approve, credit-limit, delete) только admin.
6. **Millorbot:** добавляем топики `wholesale.access_request.created`, `wholesale.order.created`, `wholesale.order.status_changed`, `wholesale.credit.limit_exceeded`, `wholesale.invoice.generated`. Переиспользуем существующий outbox + HMAC.
7. **Безопасность:** утечка оптовых цен в розничный SSR — главный риск. Защита в 4 уровня (DAL, типы, cache-tags, e2e-проверка).

---

## 1. Цели и не-цели

### Цели (MVP этого спринта)
- Оптовик может зарегистрироваться (заявка), после апрува админом — войти в кабинет.
- Видит каталог с **своими** ценами (прайс-лист, привязанный к его `WholesaleCompany`).
- Оформляет заказ через отдельный checkout, адаптированный под B2B (большие объёмы, юридические реквизиты, условия оплаты).
- Заказ попадает в существующую таблицу `Order` с `channel="wholesale"` — единый склад, единый админ-UI для просмотра, но отдельный фильтр и вкладка в админке.
- Админ/менеджер видит заказы оптовиков в `/admin/orders` (с маркером) и в новой вкладке `/admin/wholesale/orders`.
- Событие «новый оптовый заказ» идёт в Millorbot для роутинга менеджеру.

### Не-цели MVP (оставляем на следующие спринты)
- Генерация PDF-счетов, УПД, актов сверки.
- Интеграция с ЭДО (Диадок/СБИС).
- Саморегистрация с автоматической проверкой ИНН через DaData.
- Multi-user внутри одной компании (несколько закупщиков).
- Кредитные лимиты с полноценным балансом взаиморасчётов (вносим только поля + заготовку таблицы, но UI для менеджмента — Фаза 7).
- CSV-импорт позиций в корзину.
- Персональные прайс-листы с тиром по объёму (тиры в прайс-листе будут, но «индивидуальная скидка по клиенту» — через отдельный прайс-лист, не через рантайм-правила).
- 1С-интеграция.

Эти пункты в плане отражены в Фазах 5-8 — их можно строить инкрементально, не ломая MVP.

---

## 2. Архитектурное решение

### 2.1. Один Next.js, три вертикали

| Вертикаль | Префикс URL | userType | Таблица юзера | Layout |
|---|---|---|---|---|
| Розница | `/catalog`, `/cart`, `/checkout`, `/account/*`, `/auth/*` | `customer` | `User` | дефолтный (Header публичный) |
| Админка | `/admin/*` | `admin` | `AdminUser` | `app/admin/layout.tsx` |
| **Опт** | `/wholesale/*` | `wholesale` | `WholesaleUser` | `app/wholesale/layout.tsx` (новый) |

**Почему не Turborepo:**
- Все три вертикали делят Prisma, DAL, actions, лог-инфраструктуру, систему интеграций. Раздельный билд убивает DX (пересборка shared-пакетов), добавляет две конфигурации, усложняет деплой.
- Две кодовые базы вместо одной — удвоенный риск рассинхрона в зоне «инвалидация кеша при изменении продукта».
- Мы получаем 100% плюсов «общего бэкенда» без 100% минусов монорепо-оркестрации.

**Когда пересматривать:** если появятся отдельная команда/отдельный деплой-темп для опта (>10 релизов/мес, ни один из которых не трогает розницу), — вынос в Turborepo станет оправданным. Сейчас — нет.

### 2.2. Принцип изоляции цен

Оптовая цена **никогда** не должна попадать в компонент, который рендерится для розничного пользователя. Гарантия через 4 слоя:

1. **DAL-слой:** `resolvePrice(variantId, ctx: PriceContext)` — единственное место, где вычисляется цена. Принимает explicit контекст. Без контекста возвращает розничную.
2. **Типовая разметка:** `ProductCardRetail` vs `ProductCardWholesale` — разные TS-типы и разные props. Попытка передать оптовый card в розничный лист упадёт на компиляции.
3. **Cache tags:** отдельный тег `wholesale:prices:{companyId}` — инвалидируется только при изменении прайс-листа этой компании, не затрагивает `products`/`catalog`.
4. **E2E smoke-тест:** при финальном аудите — curl `/catalog` неавторизованно и assert что в ответе есть только розничные цены (проверка по ценам из БД).

### 2.3. Один `Order`, разные каналы

Не дублировать таблицу `Order` под B2B. Все заказы в одной таблице + `channel`-дискриминатор:

- Общий склад — `adjustStock()` списывает одинаково.
- Общая история статусов — `OrderStatusLog` переиспользуется.
- Общие webhook'и ЮKassa/CDEK работают.
- Админка на `/admin/orders` показывает **все** заказы с фильтром по channel.
- B2B-специфика (реквизиты, условия оплаты, статус утверждения) — в опциональных полях `Order.*`.

Плюс: отчётность строится по одному источнику правды. Минус: таблица `Order` становится шире — но это приемлемо (добавляем 5-7 полей, все nullable).

---

## 3. Схема данных

### 3.1. Новые модели

```prisma
// Юрлицо — может иметь несколько пользователей (закупщики, бухгалтер), один прайс-лист, один кредитный лимит.
model WholesaleCompany {
  id              String   @id @default(cuid())
  // Юридические реквизиты
  legalName       String   // ООО "Ромашка"
  brandName       String?  // публичное название (может совпадать)
  inn             String   @unique    // ИНН — основной идентификатор
  kpp             String?
  ogrn            String?
  legalAddress    String?  @db.Text
  postalAddress   String?  @db.Text
  // Банковские реквизиты (для будущей генерации счетов)
  bankName        String?
  bankBic         String?
  bankAccount     String?
  corrAccount     String?
  // Контакт
  contactName     String?
  contactPhone    String?
  contactEmail    String?
  // Статус
  status          String   @default("pending") // "pending" | "active" | "suspended" | "rejected"
  // Биз-условия
  paymentTerms    String   @default("prepay")  // "prepay" | "net7" | "net14" | "net30" | "net60"
  creditLimit     Int      @default(0)         // в копейках? нет — в рублях (как price в Variant)
  creditUsed      Int      @default(0)         // сколько сейчас висит в неоплаченных заказах
  priceListId     String?
  priceList       PriceList? @relation(fields: [priceListId], references: [id], onDelete: SetNull)
  // Кто одобрил
  approvedById    String?                      // AdminUser.id
  approvedAt      DateTime?
  // Управление
  managerAdminId  String?                      // AdminUser.id — ответственный менеджер
  notes           String?  @db.Text            // внутренние заметки менеджера (CRM)
  // Связи
  users           WholesaleUser[]
  accessRequests  WholesaleAccessRequest[]
  creditTx        WholesaleCreditTransaction[]
  documents       WholesaleDocument[]
  orders          Order[]
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([status])
  @@index([managerAdminId])
  @@index([priceListId])
}

// Юзер B2B-кабинета. Принадлежит одной компании (MVP; future — many-to-many через WholesaleMembership).
model WholesaleUser {
  id             String   @id @default(cuid())
  email          String   @unique
  emailVerified  DateTime?
  passwordHash   String
  name           String
  phone          String?
  role           String   @default("buyer")    // "owner" | "buyer" | "accountant" — MVP только buyer
  status         String   @default("active")   // "active" | "blocked"
  companyId      String
  company        WholesaleCompany @relation(fields: [companyId], references: [id], onDelete: Cascade)
  lastLoginAt    DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([companyId])
}

// Заявка на доступ к оптовому кабинету. Создаётся на публичной странице /wholesale/register, после апрува админом → создаётся WholesaleCompany + WholesaleUser.
model WholesaleAccessRequest {
  id             String   @id @default(cuid())
  // Что ввёл заявитель
  legalName      String
  inn            String
  contactName    String
  contactPhone   String
  contactEmail   String
  expectedVolume String?  @db.Text   // произвольный текст «~500кг/мес»
  comment        String?  @db.Text
  // Привязка после апрува
  companyId      String?
  company        WholesaleCompany? @relation(fields: [companyId], references: [id], onDelete: SetNull)
  status         String   @default("pending") // "pending" | "approved" | "rejected"
  reviewedById   String?                       // AdminUser.id
  reviewedAt     DateTime?
  reviewerNote   String?  @db.Text
  // Доп. валидация
  ipAddress      String?
  userAgent      String?  @db.Text
  createdAt      DateTime @default(now())

  @@index([status, createdAt])
  @@index([inn])
}

// Прайс-лист — коллекция кастомных цен на варианты товара. Привязывается к компаниям.
model PriceList {
  id          String   @id @default(cuid())
  name        String                          // "Базовый опт", "Сеть Х", "VIP"
  description String?  @db.Text
  isActive    Boolean  @default(true)
  // Тип: "fixed" — цена жёстко задана, "discount_pct" — от розничной вычитаем %
  kind        String   @default("fixed")      // "fixed" | "discount_pct"
  // Если kind=discount_pct — применяется ко всем вариантам с этим коэффициентом, items — override
  discountPct Int?                            // например, 20 = -20%
  // Минимальная сумма/количество заказа (для MVP — общий порог, не per-SKU)
  minOrderSum Int?
  items       PriceListItem[]
  companies   WholesaleCompany[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([isActive])
}

// Оверрайд цены для конкретного варианта в рамках прайс-листа.
model PriceListItem {
  id            String   @id @default(cuid())
  priceListId   String
  priceList     PriceList @relation(fields: [priceListId], references: [id], onDelete: Cascade)
  variantId     String
  variant       ProductVariant @relation(fields: [variantId], references: [id], onDelete: Cascade)
  price         Int                            // финальная цена за единицу в рублях
  minQuantity   Int      @default(1)           // если kind=fixed и нужны тиры — будущее расширение
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([priceListId, variantId, minQuantity])
  @@index([priceListId])
  @@index([variantId])
}

// Журнал кредитных операций (заготовка под Фазу 7 — financial ledger).
// В MVP только insert при создании/отмене оптового заказа с paymentTerms != prepay.
model WholesaleCreditTransaction {
  id          String   @id @default(cuid())
  companyId   String
  company     WholesaleCompany @relation(fields: [companyId], references: [id], onDelete: Restrict)
  amount      Int                                  // +N увеличивает долг (заказ), -N уменьшает (оплата/возврат)
  type        String                               // "order_placed" | "order_cancelled" | "payment_received" | "adjustment"
  orderId     String?
  description String?
  idempotencyKey String? @unique
  createdAt   DateTime @default(now())

  @@index([companyId, createdAt])
  @@index([orderId])
}

// Документы компании — подписанный договор, карточка компании, счета. MVP: только хранение ссылки (upload-поле), UI-CRUD в Фазе 6.
model WholesaleDocument {
  id          String   @id @default(cuid())
  companyId   String
  company     WholesaleCompany @relation(fields: [companyId], references: [id], onDelete: Cascade)
  kind        String                                // "contract" | "company_card" | "invoice" | "upd" | "act"
  orderId     String?                               // для invoice/upd/act — ссылка на заказ
  fileUrl     String                                // /uploads/wholesale/{companyId}/...
  fileName    String
  fileSize    Int
  uploadedById String?                              // AdminUser.id (либо autogen из системы)
  createdAt   DateTime @default(now())

  @@index([companyId, kind, createdAt])
  @@index([orderId])
}
```

### 3.2. Расширение существующих моделей

**`Order`** — добавить nullable-поля (безопасно для продакшна):

```prisma
model Order {
  // ... существующие поля ...

  // B2B разметка (все nullable)
  channel             String   @default("retail")   // "retail" | "wholesale"
  wholesaleCompanyId  String?
  wholesaleCompany    WholesaleCompany? @relation(fields: [wholesaleCompanyId], references: [id], onDelete: SetNull)
  wholesaleUserId     String?                        // кто из компании оформил
  paymentTerms        String?                        // снапшот условий оплаты на момент заказа
  approvalStatus      String?                        // "pending_approval" | "approved" | "rejected" — для net-terms
  approvedById        String?                        // AdminUser.id
  approvedAt          DateTime?
  // Юридические реквизиты снапшот (на случай изменения в компании)
  b2bLegalName        String?
  b2bInn              String?
  b2bKpp              String?

  @@index([channel, status, createdAt])
  @@index([wholesaleCompanyId, createdAt])
}
```

**`PromoCode`** — добавить `channel` для разделения промо розницы и опта (в MVP не трогаем в UI, но в БД вводим сразу чтобы не делать второй раз миграцию):

```prisma
channel String @default("retail") // "retail" | "wholesale" | "both"
```

**`ProductVariant`** — добавить `wholesaleMinQuantity` (минимальный оптовый заказ по этому SKU, опционально):

```prisma
wholesaleMinQuantity Int? // null = без ограничения
```

### 3.3. Безопасность миграции

Правила:
1. **Все новые колонки в существующих таблицах — nullable или с `DEFAULT`**. `Order.channel` имеет `@default("retail")` — существующие строки автоматически получат корректное значение.
2. **Миграции накатываются через `prisma migrate deploy`** на сервере через существующий `scripts/migrate.sh`.
3. **Backfill не требуется** — `channel` заполняется дефолтом, остальные nullable.
4. **Откат:** каждая миграция отдельным файлом. Если что-то пойдёт не так на проде — откатить руками через `migrate resolve --rolled-back` и `ALTER TABLE DROP COLUMN`.

### 3.4. Индексы

Добавляем сразу:
- `Order(channel, status, createdAt)` — списки заказов в админке с фильтром по каналу.
- `Order(wholesaleCompanyId, createdAt)` — «все заказы этой компании».
- `WholesaleCompany(status)` — список активных компаний.
- `WholesaleUser(companyId)` — список сотрудников компании.
- `WholesaleAccessRequest(status, createdAt)` — очередь заявок.
- `PriceListItem(priceListId, variantId)` — hot lookup при расчёте цены.

---

## 4. Auth и RBAC

### 4.1. Новый userType

Добавляем `"wholesale"` в список значений `session.user.userType`. Типизация (TypeScript) — через `types/next-auth.d.ts`:

```ts
// types/next-auth.d.ts
declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email?: string | null
      name?: string | null
      image?: string | null
      userType: "admin" | "customer" | "wholesale"
      role?: string
      status?: string
      companyId?: string       // для wholesale
      companyStatus?: string   // для wholesale
    }
  }
}
```

После этого все 14 точек чтения `userType` становятся type-safe — TS-компилятор заставит покрыть новый вариант в switch-выражениях (подсветит места, которые забыли).

### 4.2. Новый Credentials-провайдер

В `lib/auth.ts` добавить:

```ts
Credentials({
  id: "wholesale-credentials",
  name: "Wholesale",
  credentials: {
    email: { label: "Email", type: "email" },
    password: { label: "Password", type: "password" },
  },
  async authorize(credentials) {
    // rate-limit по паттерну customer-login
    // проверка emailVerified (после одобрения заявки)
    // проверка company.status === "active"
    // возврат user с userType="wholesale", companyId, companyStatus
  }
})
```

JWT/session callbacks — расширить чтобы прокидывать `companyId` и `companyStatus`.

### 4.3. Middleware

Добавить в `middleware.ts`:

```ts
// Wholesale routes
if (pathname.startsWith("/wholesale")) {
  const isPublic = pathname === "/wholesale/login" || pathname === "/wholesale/register" || pathname === "/wholesale/register/success"
  if (isPublic) {
    if (isAuthenticated && userType === "wholesale") {
      return NextResponse.redirect(new URL("/wholesale", req.url))
    }
    return NextResponse.next()
  }
  if (!isAuthenticated || userType !== "wholesale") {
    const loginUrl = new URL("/wholesale/login", req.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }
  // Дополнительно: если company.status === "suspended" — редирект на /wholesale/suspended
  const companyStatus = user?.companyStatus as string | undefined
  if (companyStatus === "suspended" && pathname !== "/wholesale/suspended") {
    return NextResponse.redirect(new URL("/wholesale/suspended", req.url))
  }
}
```

Matcher расширяется: `["/admin/:path*", "/account/:path*", "/auth/:path*", "/wholesale/:path*"]`.

### 4.4. Guards для DAL/actions

По аналогии с `lib/admin-guard.ts` создаём `lib/wholesale-guard.ts`:

```ts
export interface WholesaleContext {
  userId: string
  email: string
  name: string
  companyId: string
  company: {
    id: string
    status: string
    priceListId: string | null
    paymentTerms: string
    creditLimit: number
    creditUsed: number
  }
}

export async function requireWholesale(): Promise<WholesaleContext>
export async function getWholesaleContext(): Promise<WholesaleContext | null>
```

`requireWholesale` проверяет session.userType, подгружает свежий `company` из БД (не из JWT — статус может измениться) и возвращает полный контекст.

### 4.5. RBAC в админке

Добавляем permissions в `lib/permissions.ts`:

```ts
// Wholesale management — admin/manager read; admin-only write
"wholesale.requests.view",
"wholesale.requests.approve",       // admin only
"wholesale.companies.view",
"wholesale.companies.edit",
"wholesale.companies.delete",       // admin only
"wholesale.priceLists.view",
"wholesale.priceLists.edit",        // admin only
"wholesale.priceLists.delete",      // admin only
"wholesale.orders.view",
"wholesale.orders.updateStatus",
"wholesale.orders.approve",         // admin only (для net-terms заказов)
"wholesale.credit.view",
"wholesale.credit.adjust",          // admin only
"wholesale.notes.edit",
```

Менеджер: `view` + `updateStatus` + `notes.edit`. Остальное — admin only.

### 4.6. Registration flow

`/wholesale/register` — публичная страница с формой:
1. Заявитель заполняет ИНН + контакты.
2. Опционально — кнопка «Подставить данные по ИНН» (заглушка под DaData, Фаза 8).
3. Submit → `createWholesaleAccessRequest` server action. Rate-limit по email+IP (2/час).
4. Запись в `WholesaleAccessRequest(status="pending")`.
5. Событие в Millorbot `wholesale.access_request.created` → менеджер получает уведомление.
6. Админ в `/admin/wholesale/requests` видит заявку, жмёт «Одобрить».
7. При апруве — создаётся `WholesaleCompany(status="active")`, генерится временный пароль, создаётся `WholesaleUser(emailVerified=now, status="active")`, отправляется письмо «Доступ открыт: вот ваш логин/ссылка на задание пароля».
8. Заявитель идёт на `/wholesale/login` или по ссылке reset-password.

---

## 5. Routing: карта `/wholesale/*`

```
/wholesale                         — Dashboard (последние заказы, остатки бюджета, новости)
/wholesale/login                   — вход
/wholesale/register                — заявка
/wholesale/register/success        — «заявка принята»
/wholesale/suspended               — «аккаунт приостановлен, свяжитесь с менеджером»
/wholesale/password/reset          — сброс пароля (переиспользуем VerificationCode)
/wholesale/password/reset/confirm  — установка нового

/wholesale/catalog                 — каталог опта (с прайс-листом компании)
/wholesale/catalog/[slug]          — карточка SKU (оптовые цены, минимальные объёмы)

/wholesale/cart                    — корзина B2B
/wholesale/checkout                — оформление (условия оплаты, адрес, комментарий)
/wholesale/checkout/success        — success-страница + номер заказа

/wholesale/orders                  — история заказов компании
/wholesale/orders/[id]             — детали заказа (статус, трекинг, документы)
/wholesale/orders/[id]/repeat      — повтор заказа (складывает те же позиции в корзину)

/wholesale/company                 — профиль компании (реквизиты, условия оплаты — read-only)
/wholesale/company/users           — список сотрудников (read-only в MVP; Фаза 8 — добавление)

/wholesale/price-list              — HTML-рендер прайс-листа (скачиваемая версия — Фаза 5)
/wholesale/documents               — список документов компании (Фаза 6)
```

**Layout:** `app/wholesale/layout.tsx` — свой header с логотипом, навигацией и инфо-плашкой про остаток кредита.

**SEO:** весь `/wholesale/*` — `robots: { index: false, follow: false }` + `noindex` в meta. Sitemap не включает `/wholesale`.

---

## 6. Pricing engine

Критичный модуль. Всё в `lib/dal/pricing.ts` (новый файл):

```ts
export interface PriceContext {
  channel: "retail" | "wholesale"
  // Для wholesale:
  priceListId?: string | null
  companyId?: string
}

export interface ResolvedPrice {
  price: number          // финальная цена за штуку
  oldPrice: number | null // для зачёркивания
  discountPct: number | null
  minQuantity: number
  source: "retail" | "pricelist_item" | "pricelist_discount"
}

// Ключевая функция
export async function resolvePrice(
  variantId: string,
  ctx: PriceContext
): Promise<ResolvedPrice>

// Батч для каталога
export async function resolvePrices(
  variantIds: string[],
  ctx: PriceContext
): Promise<Map<string, ResolvedPrice>>
```

Алгоритм:
1. Если `ctx.channel === "retail"` → вернуть `variant.price` / `variant.oldPrice`.
2. Если `"wholesale"` без `priceListId` → вернуть розничную (fallback).
3. Если есть `priceListId`:
   - Ищем `PriceListItem(priceListId, variantId)` — если есть, это финальная цена (`source: "pricelist_item"`).
   - Если нет и `kind="discount_pct"` — применяем процент к розничной (`source: "pricelist_discount"`).
   - Если нет и `kind="fixed"` — возвращаем розничную (это значит «не продаём этот SKU оптом с этой ценой»). **Вариант B:** возвращаем `null` и на UI скрываем SKU из каталога. Решение: **фоллбек на розничную** в MVP (проще), а в Фазе 5 — добавим чекбокс «скрывать SKU без цены в прайс-листе».

Все вызовы каталога/корзины/чекаута идут через `resolvePrice(s)` — никакого прямого чтения `variant.price` в wholesale-путях.

### 6.1. Отдельный DAL слой для оптового каталога

`lib/dal/wholesale-catalog.ts`:

```ts
export async function getWholesaleCatalog(ctx: WholesaleContext): Promise<WholesaleProductCard[]>
export async function getWholesaleProductBySlug(slug: string, ctx: WholesaleContext): Promise<WholesaleProductDetail | null>
```

Они строят пейлоад на базе `productCardSelect` (из `lib/dal/products.ts`), но вместо статической цены кладут `resolvePrice` результат. Кеш-тег: `wholesale:catalog:{priceListId}`.

### 6.2. Инвалидация

- Изменение `PriceList` / `PriceListItem` в админке → `revalidateTag('wholesale:catalog:' + priceListId)`.
- Привязка компании к другому прайс-листу → `revalidateTag('wholesale:company:' + companyId)`.
- Изменение `ProductVariant.price` (админ) → **не** инвалидирует `wholesale:catalog` (оптовая цена от этого не меняется для `pricelist_item`-типа; для `discount_pct` — нужно инвалидировать, поэтому также зовём `revalidateTag('wholesale:catalog:*')` при изменении variant).

---

## 7. Cart & Checkout B2B

### 7.1. Отдельный store

`lib/store/wholesale-cart.ts` — Zustand с persist key `millor-wholesale-cart`. Структура `WholesaleCartItem`:

```ts
interface WholesaleCartItem {
  productId: string
  variantId: string
  name: string
  weight: string
  quantity: number
  slug: string
  image: string
  // Цены — snapshot на момент добавления (будет pricing check на checkout)
  unitPrice: number
  unitOldPrice: number | null
  minQuantity: number
}
```

Почему отдельный store: разные правила валидации (мин.кол-во), разные поля, другая инвалидация цен, и розничная корзина остаётся гостевой (на одном устройстве может быть и розничная, и оптовая — не смешиваем).

### 7.2. Pricing refresh

На `/wholesale/cart` и `/wholesale/checkout` при маунте вызывается API `/api/wholesale/cart/refresh` — берёт cart items, делает `resolvePrices(ctx)`, если цены изменились — обновляет store и показывает тост «Цены обновлены».

### 7.3. Валидация checkout

Сервер-actions `submitWholesaleOrder`:
1. `requireWholesale()` — получить контекст.
2. Пересчитать все цены через `resolvePrices` — если отличаются от присланных клиентом более чем на 1₽ → error "prices_changed".
3. Проверить stock по каждой позиции.
4. Проверить `variant.wholesaleMinQuantity` если задан.
5. Проверить `priceList.minOrderSum` если задан.
6. Если `paymentTerms !== "prepay"`:
   - Проверить `company.creditUsed + orderTotal <= company.creditLimit`.
   - Если нет — error "credit_limit_exceeded".
   - Установить `approvalStatus = "pending_approval"`.
7. Вызвать `createOrder` из `lib/dal/orders.ts` с новыми параметрами:
   - `channel: "wholesale"`
   - `wholesaleCompanyId`, `wholesaleUserId`
   - `paymentTerms`
   - Доставка: MVP — оставить адрес из формы (как у розницы), CDEK/Почта работают без изменений.
   - Bonus/promo — **отключить в MVP** (в оптовом checkout нет этих полей; на бэке — игнор если channel=wholesale).
8. Если `paymentTerms !== "prepay"` — создать `WholesaleCreditTransaction(amount=+total, type="order_placed")`, `UPDATE WholesaleCompany.creditUsed += total`.
9. `enqueueOutbox("wholesale.order.created", payload)` для Millorbot.
10. `dispatchEmail(kind="wholesale.order.confirmation")` клиенту + `kind="wholesale.admin.new_order"` менеджеру компании.

### 7.4. Рефактор `lib/dal/orders.ts:createOrder`

Чтобы принимать оба канала:
- Добавить в `OrderData` опциональные поля `channel`, `wholesaleCompanyId`, `wholesaleUserId`, `paymentTerms`, `b2bLegalName`, `b2bInn`, `b2bKpp`.
- Если `channel === "wholesale"`:
  - Пропустить bonus-начисление/списание.
  - Пропустить promo (или проверять `PromoCode.channel`).
  - Заполнить B2B-поля в снапшот.
- Stock-логика — без изменений (единый склад).

### 7.5. Online-оплата vs net-terms

- `paymentTerms === "prepay"` → создаётся платёж ЮKassa как у розницы (`paymentMethod="online"`), после оплаты — `createShipment`. Обычный flow.
- `paymentTerms === "net*"` → `paymentMethod=null`/`postpay`, заказ сразу в статусе `confirmed` (или `pending_approval` если админ должен апрувнуть для больших сумм), счёт генерируется вручную менеджером (Фаза 5 — автогенерация). Оплата фиксируется менеджером вручную через `/admin/wholesale/credit`.

---

## 8. Order pipeline

Расширяем существующую `updateOrderStatus` в `lib/dal/orders.ts`:

### 8.1. Новые статусы для wholesale

Оставляем текущие `pending | confirmed | shipped | delivered | cancelled`. Добавляем **опциональный** `approvalStatus` (параллельно с `status`):
- `null` — не требует апрува (prepay).
- `"pending_approval"` — ждёт решения менеджера (net-terms).
- `"approved"` — одобрен, можно отгружать.
- `"rejected"` — отклонён, stock возвращён.

Переход `status: pending → confirmed` для wholesale с net-terms требует `approvalStatus === "approved"` (иначе ошибка в action). Для prepay — apres успешной оплаты, как раньше.

### 8.2. Отмена

При `cancelOrder(orderId)` для channel=wholesale:
- Возврат stock — как у розницы.
- Если `paymentTerms !== prepay` → `WholesaleCreditTransaction(amount=-total, type="order_cancelled")`, `UPDATE creditUsed -= total`.
- Бонусы — не трогаем (их и не было).

### 8.3. События в Millorbot

Topics:
- `wholesale.order.created` — при successful createOrder.
- `wholesale.order.approved` — при смене `approvalStatus: pending_approval → approved`.
- `wholesale.order.status_changed` — при смене `status` (опционально; можно переиспользовать общий `order.status_changed` с `channel` в payload).
- `wholesale.order.cancelled` — при `status: * → cancelled`.

Payload включает полный снапшот компании и контактов — чтобы бот мог роутить сообщение ответственному менеджеру (`managerAdminId` → их Telegram chat_id в боте).

---

## 9. Admin: вертикаль «Оптовики»

### 9.1. Навигация

В `components/admin/AdminSidebar.tsx` добавить группу (видна по permission `wholesale.companies.view`):

```
Оптовики
  - Заявки          /admin/wholesale/requests
  - Компании        /admin/wholesale/companies
  - Прайс-листы     /admin/wholesale/price-lists
  - Заказы          /admin/wholesale/orders
  - Кредит          /admin/wholesale/credit (Фаза 7)
  - Документы       /admin/wholesale/documents (Фаза 6)
```

Заказы также доступны в общей вкладке `/admin/orders` с фильтром «Канал: Все | Розница | Опт».

### 9.2. Экраны MVP

1. **`/admin/wholesale/requests`** — список заявок (pending/approved/rejected). Action «Одобрить» открывает модалку: подтверждение реквизитов + выбор прайс-листа + условий оплаты + менеджера. По submit — создаёт Company + User + отправляет письмо с приглашением.
2. **`/admin/wholesale/companies`** — таблица всех компаний. Фильтры: статус, менеджер, прайс-лист. Клик → `/admin/wholesale/companies/[id]` (профиль компании: реквизиты, прайс-лист, кредит-лимит, сотрудники, последние заказы, заметки CRM, кнопки Suspend/Reject/Reset Password).
3. **`/admin/wholesale/price-lists`** — CRUD списков. Клик → `/admin/wholesale/price-lists/[id]` (inline-редактор items: таблица все-варианты × цена). Импорт CSV — Фаза 5.
4. **`/admin/wholesale/orders`** — идентично `/admin/orders` с жёстким фильтром `channel=wholesale`. Дополнительные колонки: компания, условия оплаты, approvalStatus. Action-кнопки: «Одобрить к отгрузке» (меняет approvalStatus), «Пометить оплаченным» (для net-terms — создаёт WholesaleCreditTransaction с минусом).
5. **`/admin/orders/[id]`** — расширяется: если `channel="wholesale"` показывает блок «Оптовик» с ссылкой на компанию и кнопкой «Одобрить» (если нужно).

### 9.3. Actions

Все в `lib/actions/wholesale.ts`:
```ts
createWholesaleAccessRequest(data)      // публичная — без requireAdmin
approveWholesaleAccessRequest(id, opts) // requireAdmin("wholesale.requests.approve")
rejectWholesaleAccessRequest(id, note)
createWholesaleCompany(data)
updateWholesaleCompany(id, patch)
suspendWholesaleCompany(id, reason)
deleteWholesaleCompany(id)              // only if no orders, иначе soft
createPriceList(data)
updatePriceList(id, patch)
deletePriceList(id)                     // only if not used by active companies
upsertPriceListItem(priceListId, variantId, price, minQuantity)
deletePriceListItem(id)
assignPriceListToCompany(companyId, priceListId)
adjustCreditLimit(companyId, newLimit, reason)
recordCreditPayment(companyId, amount, note, orderId?) // при вручную полученной оплате
approveWholesaleOrder(orderId)
rejectWholesaleOrder(orderId, reason)
```

Все — с `requireAdmin(permission)` + `logAdminAction` + `revalidatePath`.

### 9.4. Фильтр в общей `/admin/orders`

В существующий `/admin/orders/page.tsx` добавить фильтр `channel` (query param `?channel=retail|wholesale|all`). Бейдж в строке заказа: «Опт» / «Розница».

---

## 10. Millorbot — новые события

### 10.1. Topics

Переиспользуем существующий outbox + HMAC. Новые topic'и:
- `wholesale.access_request.created` — заявка подана.
- `wholesale.access_request.approved` — заявка одобрена (уведомление внутрь команды + самому клиенту через email).
- `wholesale.order.created` — новый оптовый заказ.
- `wholesale.order.approved` — одобрен к отгрузке.
- `wholesale.order.cancelled`
- `wholesale.credit.payment_received` — менеджер вручную отметил оплату.
- `wholesale.credit.limit_approaching` — `creditUsed >= 80% creditLimit` (фоновый воркер, опционально в MVP).

### 10.2. Endpoint со стороны бота

Бот принимает их через существующий паттерн:
```
POST {MILLORBOT_URL}/api/wholesale/access_requests
POST {MILLORBOT_URL}/api/wholesale/orders
POST {MILLORBOT_URL}/api/wholesale/orders/status
```
Маршрутизация в боте — отдельный Telegram-топик/канал для B2B-менеджеров, с привязкой `managerAdminId → chat_id`.

**В MVP сайта** мы создаём события в Outbox, но реальная доставка начнёт работать после того, как боте будут реализованы соответствующие handler'ы (задача отдельной Python-сессии, не блокирует фронт). Флаг `MILLORBOT_ENABLED` остаётся тем же.

### 10.3. Payload структура

В `lib/integrations/millorbot/payload.ts` добавить `buildWholesaleOrderPayload(order, { eventId })`:
```ts
{
  event_id,
  event: "wholesale.order.created",
  occurred_at,
  order: { id, number, total, paymentTerms, approvalStatus, items, admin_url },
  company: { id, legalName, inn, managerAdminId },
  user: { id, name, email, phone }
}
```

### 10.4. Tracking updates

Pull-вебхук `/api/webhooks/millorbot/tracking` — без изменений (он и так обрабатывает любые Order записи независимо от channel).

---

## 11. Email templates

Новые kind'ы для `dispatchEmail`:
- `wholesale.access_request.submitted` — клиенту «заявка принята».
- `wholesale.access_request.approved` — клиенту «доступ открыт» + ссылка на установку пароля.
- `wholesale.access_request.rejected` — клиенту «отказ с причиной».
- `wholesale.order.confirmation` — клиенту «заказ создан».
- `wholesale.order.approved` — клиенту «заказ одобрен к отгрузке» (для net-terms).
- `wholesale.order.shipped` — клиенту.
- `wholesale.order.delivered` — клиенту.
- `wholesale.admin.new_order` — менеджеру компании.
- `wholesale.admin.access_request` — менеджерам (дубль Telegram — на случай если бот не дошёл).
- `wholesale.admin.credit_limit_warning` — менеджеру.

Шаблоны в `lib/email/templates/wholesale/` — отдельная папка. React-email или простая HTML-вёрстка (в проекте уже есть паттерн — переиспользуем).

---

## 12. Безопасность

### 12.1. Угрозы и митигации

| Угроза | Митигация |
|---|---|
| Розничный юзер получает оптовые цены (утечка) | (1) `resolvePrice` никогда не вернёт оптовую без `ctx.channel="wholesale"`. (2) Отдельные DAL-функции. (3) Cache tags раздельные. (4) E2E-check в финальном аудите. |
| Оптовый юзер видит чужой прайс-лист/компанию | Все DAL принимают `companyId` из `requireWholesale()` (берётся из БД, не из JWT). Фильтры в запросах обязательны. |
| Манипуляция total через клиентский submit | `resolvePrice` пересчёт на сервере + валидация разности ≤1₽. |
| Брутфорс wholesale-логина | Rate-limit по ключу `wholesale-login:{email}:{ip}` (3/5мин, блок 15мин). |
| Брутфорс заявки (спам) | Rate-limit по `wholesale-request:{email/ip}` (2/час), капча (hCaptcha/turnstile) — опционально, Фаза 5 если нужно. |
| Привилегия-эскалация: customer становится wholesale | Три отдельные таблицы, отдельная provider-цепочка, отдельный userType в JWT. Один email может быть и customer, и wholesale — это нормально (разные кабинеты). |
| Утечка кредит-лимита | Клиент видит свой — нормально. Чужой — не видит (DAL всегда фильтрует). |
| IDOR в `/wholesale/orders/[id]` | DAL проверяет `order.wholesaleCompanyId === ctx.companyId` — 404 если не совпадает. |
| Неавтоматизированный approval net-terms заказов | Админ обязан руками нажать «Одобрить к отгрузке»; до этого заказ не уходит в shipment. |

### 12.2. Аудит-лог

Все действия в `/admin/wholesale/*` логируются через `logAdminAction` с `entityType: "wholesale_company"` / `"wholesale_order"` / `"price_list"` и т.д. 

---

## 13. Тестирование

### 13.1. Smoke-тесты (в рамках финального аудита спринта)

1. Регистрация заявки (public) → запись в БД → событие в Outbox → email клиенту.
2. Апрув заявки админом → создание Company + User + email клиенту.
3. Логин оптовика.
4. Каталог опта показывает цены из прайс-листа.
5. Добавление в корзину, checkout с `paymentTerms=prepay` → ЮKassa flow → заказ в `Order` с `channel=wholesale`.
6. Checkout с `paymentTerms=net30` → заказ с `approvalStatus=pending_approval`, без ЮKassa.
7. Админ одобряет net-terms заказ → `approvalStatus=approved`, shipment.
8. Отмена заказа → stock возврат + credit reversal.
9. Розничный каталог `/catalog` — ни одной оптовой цены в HTML (curl + grep).
10. Middleware: `/wholesale/catalog` без логина → 302 на login.
11. Middleware: customer пытается зайти в `/wholesale` → 302 на login.
12. Middleware: wholesale пытается зайти в `/admin` → 302 на admin login.

### 13.2. Типы + lint + build

- `tsc --noEmit` чисто.
- `npm run lint` чисто.
- `npm run build` зелёный.
- Prisma migrate локально применяется без ошибок.

---

## 14. Фазы реализации

### Фаза 0 — Schema & Auth foundation (этот спринт)
- [ ] Prisma schema: новые модели + расширения Order/PromoCode/ProductVariant.
- [ ] Миграция `202604240001_wholesale_foundation`.
- [ ] `types/next-auth.d.ts` — типизация userType.
- [ ] `lib/auth.ts` — провайдер `wholesale-credentials` + callbacks.
- [ ] `lib/wholesale-guard.ts` — helpers.
- [ ] `middleware.ts` — обработка `/wholesale/*`.
- [ ] `lib/permissions.ts` — новые wholesale-permissions.
- [ ] Сид дефолтного прайс-листа «Базовый опт» + seed-скрипт.

### Фаза 1 — Pricing engine & wholesale catalog (этот спринт)
- [ ] `lib/dal/pricing.ts` — `resolvePrice` / `resolvePrices`.
- [ ] `lib/dal/wholesale-catalog.ts` — каталог.
- [ ] Pages: `/wholesale/catalog`, `/wholesale/catalog/[slug]`.
- [ ] Cache tags + инвалидация.

### Фаза 2 — Cart & Checkout (этот спринт)
- [ ] `lib/store/wholesale-cart.ts` — Zustand.
- [ ] Pages: `/wholesale/cart`, `/wholesale/checkout`, `/wholesale/checkout/success`.
- [ ] API: `/api/wholesale/cart/refresh`.
- [ ] Server action `submitWholesaleOrder`.
- [ ] Расширение `lib/dal/orders.ts:createOrder` на channel.
- [ ] Интеграция с ЮKassa (prepay-flow) — прежний путь.
- [ ] Net-terms flow — без ЮKassa.

### Фаза 3 — Account area & public registration (этот спринт)
- [ ] `/wholesale/register` + action `createWholesaleAccessRequest`.
- [ ] `/wholesale/login`, `/wholesale/password/reset/*`.
- [ ] `/wholesale/orders`, `/wholesale/orders/[id]`, `/wholesale/orders/[id]/repeat`.
- [ ] `/wholesale/company`, `/wholesale/company/users`.
- [ ] Email templates wholesale.*.

### Фаза 4 — Admin «Оптовики» (этот спринт)
- [ ] Nav группа в AdminSidebar (по permission).
- [ ] `/admin/wholesale/requests` + approve/reject actions.
- [ ] `/admin/wholesale/companies` + CRUD.
- [ ] `/admin/wholesale/price-lists` + CRUD + editor items.
- [ ] `/admin/wholesale/orders` — таблица + approve.
- [ ] Фильтр `channel` в `/admin/orders`.
- [ ] Millorbot events (enqueue в Outbox).

### Фаза 5 — Документы и выгрузки (следующий спринт)
- [ ] PDF-рендер счёта по заказу (server-side, с российскими реквизитами).
- [ ] Загрузка/скачивание договоров в `/admin/wholesale/companies/[id]/documents`.
- [ ] Экспорт прайс-листа в XLSX для клиента.
- [ ] CSV-импорт прайс-листа в админке.

### Фаза 6 — Credit management UI (следующий спринт)
- [ ] `/admin/wholesale/credit` — таблица балансов, фильтры.
- [ ] Ручной ввод «Получена оплата» → WholesaleCreditTransaction.
- [ ] Автонотификация «превышен 80% лимит» (cron + Outbox).
- [ ] Отображение свободного кредита у клиента в `/wholesale`.

### Фаза 7 — Multi-user & роли внутри компании (следующий спринт)
- [ ] Приглашение сотрудников владельцем компании.
- [ ] Разграничение `owner | buyer | accountant` — разные права внутри кабинета.
- [ ] История «кто из компании что заказал».

### Фаза 8 — Саморегистрация + DaData (следующий спринт)
- [ ] Интеграция с DaData API (КЛАДР + организации по ИНН).
- [ ] Автозаполнение формы заявки.
- [ ] Автоматическая проверка OGRN/INN валидности + статуса юрлица.
- [ ] Опциональная автоактивация для «зелёных» юрлиц (стабильные, не в дисквалификации).

---

## 15. Риски и митигации

| Риск | Вероятность | Импакт | Митигация |
|---|---|---|---|
| Миграция упадёт на проде | низкая | высокий | Все поля nullable/DEFAULT. Тестим на staging-копии БД через `pg_dump`-restore. |
| Оптовые цены просочатся в розничный SSR | средняя | критический | 4 слоя защиты (см. §6). Обязательный E2E-curl-check в аудите. |
| Новый flow заказа сломает розничный `createOrder` | средняя | высокий | Расширение функции, не дубляж. Параметры nullable. Регрессия прогоняется smoke-тестом розницы. |
| Millorbot не успеет подхватить новые топики | высокая | низкий | События копятся в Outbox, начнут доставляться когда бот будет готов. Параллельная задача для бота — отдельно. |
| Admin-UI слишком сложный для MVP | средняя | средний | Ограничить MVP базовыми экранами (requests, companies, price-lists, orders). Отложить documents/credit-management на Фазу 5-6. |
| Customer ↔ Wholesale email-коллизии | низкая | средний | Одобряем: один email может быть и там, и там. Unique в разных таблицах. JWT userType решает куда вести. |
| Потеря prepay-оплаты при rollback заказа | низкая | высокий | Re-use существующей `rollbackOrder` — уже обрабатывает refund ЮKassa. |

---

## 16. Acceptance criteria спринта

- [ ] Все миграции применены локально и на staging без ошибок.
- [ ] `npm run build` зелёный.
- [ ] `tsc --noEmit` зелёный.
- [ ] `npm run lint` зелёный.
- [ ] Smoke-тесты из §13.1 проходят.
- [ ] Finalный аудит выполнен (см. Task #4) без HIGH-issues.
- [ ] Коммит + push + deploy на beget через git pull → docker rebuild.
- [ ] На проде: регистрация заявки работает, админ может одобрить, оптовик может залогиниться, оформить заказ, заказ появляется в админке с каналом `wholesale`.
- [ ] Розничный `/catalog` по-прежнему показывает только розничные цены (визуально + через curl-check).

---

## 17. Что уходит в CLAUDE.md после мёрджа

Добавить раздел «Wholesale Cabinet»:
- Auth: `userType: "admin" | "customer" | "wholesale"`, три отдельные таблицы.
- Pricing: никогда не читать `variant.price` напрямую для wholesale-контекста — только через `resolvePrice`.
- Channel: все новые места работы с Order учитывают `channel`. Розничные пути — фильтруют `channel=retail`.
- Admin группа: `wholesale.*` permissions.
- Millorbot topics: `wholesale.*`.

---

## 18. Открытые вопросы (решить в процессе или отложить)

1. **Гостевой wholesale-checkout (без регистрации)?** — Нет. Только после апрува заявки. Это ключевое отличие B2B.
2. **Показывать ли минимальную сумму заказа на каталоге?** — Да, в header кабинета.
3. **Один или несколько прайс-листов у компании?** — Один в MVP. Мульти-прайс (сезонный/базовый) — Фаза 5.
4. **Скидки по объёму (tier pricing)?** — Не в MVP. Поле `PriceListItem.minQuantity` заложено для расширения.
5. **Нужно ли разрешать розничному юзеру параллельно иметь wholesale-кабинет (same email)?** — Да, технически. Один email — две записи в разных таблицах. Разные логины (страницы).
6. **Отдельный поддомен `opt.millor-shop.ru`?** — Не в MVP. `/wholesale/*` достаточно. Поддомен — Фаза 5 при необходимости брендинга.
7. **Отдельный Prisma-датасорс/БД?** — Нет. Одна БД, одна схема. Единый склад — ключевая причина.

---

## Приложение A — Конкретные файлы для создания/изменения

### Новые
```
prisma/migrations/202604240001_wholesale_foundation/migration.sql
prisma/seed-wholesale.ts
types/next-auth.d.ts                            (если нет)
lib/wholesale-guard.ts
lib/dal/pricing.ts
lib/dal/wholesale-catalog.ts
lib/dal/wholesale-companies.ts
lib/dal/wholesale-orders.ts
lib/dal/wholesale-price-lists.ts
lib/dal/wholesale-access-requests.ts
lib/dal/wholesale-credit.ts
lib/actions/wholesale.ts
lib/actions/wholesale-orders.ts
lib/actions/wholesale-price-lists.ts
lib/actions/wholesale-requests.ts
lib/store/wholesale-cart.ts
lib/integrations/millorbot/wholesale-payload.ts
lib/email/templates/wholesale/*.tsx
app/wholesale/layout.tsx
app/wholesale/page.tsx                          (dashboard)
app/wholesale/login/page.tsx
app/wholesale/register/page.tsx
app/wholesale/register/success/page.tsx
app/wholesale/suspended/page.tsx
app/wholesale/password/reset/page.tsx
app/wholesale/password/reset/confirm/page.tsx
app/wholesale/catalog/page.tsx
app/wholesale/catalog/[slug]/page.tsx
app/wholesale/cart/page.tsx
app/wholesale/checkout/page.tsx
app/wholesale/checkout/success/page.tsx
app/wholesale/orders/page.tsx
app/wholesale/orders/[id]/page.tsx
app/wholesale/company/page.tsx
app/wholesale/company/users/page.tsx
app/wholesale/price-list/page.tsx
app/api/wholesale/cart/refresh/route.ts
app/admin/wholesale/layout.tsx                  (опц.)
app/admin/wholesale/requests/page.tsx
app/admin/wholesale/requests/[id]/page.tsx
app/admin/wholesale/companies/page.tsx
app/admin/wholesale/companies/[id]/page.tsx
app/admin/wholesale/price-lists/page.tsx
app/admin/wholesale/price-lists/[id]/page.tsx
app/admin/wholesale/orders/page.tsx
components/wholesale/Header.tsx
components/wholesale/ProductCard.tsx
components/wholesale/CartRow.tsx
components/wholesale/CheckoutForm.tsx
components/admin/wholesale/RequestRow.tsx
components/admin/wholesale/CompanyForm.tsx
components/admin/wholesale/PriceListEditor.tsx
```

### Изменяемые
```
prisma/schema.prisma
lib/auth.ts
middleware.ts
lib/permissions.ts
lib/cache-tags.ts
lib/dal/orders.ts
lib/actions/orders.ts
lib/integrations/stock-alerts.ts                (добавить channel в payload)
lib/integrations/millorbot/types.ts
lib/integrations/millorbot/client.ts            (если нужен роутинг per-topic)
components/admin/AdminSidebar.tsx
app/admin/orders/page.tsx                        (фильтр channel)
app/admin/orders/[id]/page.tsx                   (блок Оптовик)
CLAUDE.md                                        (после мёрджа — раздел Wholesale)
```

---

_План пишется на 2026-04-24. Автор: Claude + Кирилл. Утверждён к реализации._
