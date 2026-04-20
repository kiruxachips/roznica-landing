# Sprint: глубокая оптимизация производительности — 2026-04-20

Этот документ — исполняемый поэтапный план по результатам аудита от 2026-04-20. Цель — устранить узкие места, выявленные по 4-м зонам (БД, Frontend, Админка, API/Infra), в порядке от самых опасных к архитектурным улучшениям.

Каждый пункт содержит: **файл**, **проблему**, **как чиним**, **как верифицируем**, **риски**. После каждой фазы — отдельный commit, чтобы можно было откатить поштучно.

---

## 🧭 Принципы спринта

1. **Деплой только через git push → pull → rebuild на beget.** Никакого rsync (см. memory `feedback_deploy_flow.md`).
2. **Нет Redis, нет Edge Runtime** на shared beget — в пределах Node + ISR Next.js.
3. **`auth()` в page** автоматически делает страницу dynamic. Это значит, что `revalidate` на странице с `auth()` не сработает без рефакторинга — избегаем таких конфликтов.
4. **Каждая фаза проверяется `npm run build` локально** перед коммитом. Функциональность не должна сломаться.
5. **БД-миграции Prisma** — только через `prisma migrate dev --name <slug>`, не `prisma db push`. Миграция применяется на сервере в той же фазе деплоя.

---

## 🔴 ФАЗА 1 — CRITICAL (убираем самое дорогое)

### 1.1 Индексы Prisma на горячие запросы

**Файл:** `prisma/schema.prisma`

**Проблема:** full-table scan при ILIKE-поиске заказов, фильтрах каталога, проверке `isActive + categoryId`, листинге вариантов, фильтрах блога.

**Правки:**
```prisma
// Product — добавить:
@@index([isActive, sortOrder])
@@index([isActive, categoryId])
@@index([isActive, productType])
@@index([isActive, isFeatured, sortOrder])

// ProductVariant — добавить:
@@index([isActive, productId])
@@index([stock])

// Review — добавить:
@@index([productId, isVisible])

// Article — добавить:
@@index([isPublished, publishedAt])
@@index([categoryId, isPublished])

// Category — добавить:
@@index([parentId])

// Order — добавить к существующим:
@@index([createdAt])
@@index([orderNumber])
@@index([customerPhone])
@@index([customerEmail])

// OutboxEvent — уже есть @@index([status, nextAttemptAt]) — ок
```

**Проверка:** `npx prisma migrate dev --name perf_indexes_v2` запускается без ошибок, `EXPLAIN ANALYZE` на типичные запросы показывает Index Scan вместо Seq Scan.

**Риск:** миграция создаётся CONCURRENTLY только вручную; для прод-БД с большими таблицами стоит использовать `CREATE INDEX CONCURRENTLY`. На текущем объёме данных (десятки/сотни товаров) безопасно.

---

### 1.2 `getShopStats` — агрегация на уровне БД

**Файл:** `lib/dal/stats.ts:16-20`

**Проблема:** `prisma.review.findMany({ select: { rating: true } })` тянет весь список отзывов в память и считает среднее в JS — линейный расход памяти и CPU на каждый рендер главной.

**Правка:** заменить на `prisma.review.aggregate({ where: { isVisible: true }, _avg: { rating: true }, _count: { _all: true } })`.

**Проверка:** социальная плашка на главной показывает правильные цифры, в логе нет ошибок.

---

### 1.3 Убрать `revalidatePath("/")` из действий с товарами и заменить на теги

**Файлы:**
- `lib/actions/products.ts:81-83, 131-134, 151-153, 174-176, 331-333`
- `lib/actions/stock.ts` — аналогично, если встречается.

**Проблема:** каждый апдейт товара инвалидирует весь ISR → главная и каталог пересобираются с нуля.

**Правка:**
1. Ввести централизованную карту тегов в `lib/cache-tags.ts`:
   ```ts
   export const CACHE_TAGS = {
     products: 'products',
     product: (slug: string) => `product:${slug}`,
     catalog: 'catalog',
     homepage: 'homepage',
     filters: 'catalog-filters',
     stats: 'shop-stats',
     articles: 'articles',
     collections: 'collections',
   }
   ```
2. В DAL обернуть горячие функции в `unstable_cache(fn, [key], { revalidate, tags })`:
   - `getFeaturedProducts` — `{ tags: [CACHE_TAGS.products, CACHE_TAGS.homepage], revalidate: 300 }`
   - `getShopStats` — `{ tags: [CACHE_TAGS.stats], revalidate: 600 }`
   - `getFilterOptions` — `{ tags: [CACHE_TAGS.filters], revalidate: 3600 }`
   - `getProductSlugs` (sitemap) — `{ revalidate: 86400 }`
3. В actions заменить `revalidatePath("/")` и `revalidatePath("/catalog")` на `revalidateTag(...)` по списку затронутых тегов.

**Проверка:** после обновления товара в админке:
- Админка меняется сразу (`revalidatePath("/admin/products")`).
- Каталог и главная получают свежие данные (`revalidateTag(CACHE_TAGS.catalog)`).
- Другие страницы (`/blog`, `/account`) кэш не теряют.

**Риск:** Если какая-то страница с `auth()` рендерит товары, она всё равно была dynamic. `unstable_cache` не заработает для функций, напрямую завязанных на `auth()` (они должны вынести fetch в DAL без `auth` и получать `session` отдельно — у нас так и есть).

---

### 1.4 `getStockSnapshot` — фильтрация в SQL

**Файл:** `lib/dal/stock.ts` (поиск функции `getStockSnapshot`).

**Проблема:** тянет все варианты в память, `.filter()` по status в JS → при 5000+ вариантов 5+ МБ JSON и O(N) в Node.

**Правка:**
1. Перенести фильтры `status: "out" | "low"` в `where`:
   - `out`: `{ stock: { lte: 0 } }`
   - `low`: raw-условие `stock > 0 AND stock <= lowStockThreshold AND lowStockThreshold IS NOT NULL` через `prisma.$queryRaw` или `Prisma.sql`.
2. Фильтр по weight тоже уходит в `where` (строка соответствия).
3. Добавить `take/skip` (50/страница).

**Проверка:** страница `/admin/warehouse` с фильтром "Нет в наличии" грузится <500 мс на сотнях вариантов.

---

### 1.5 `/admin/products` — серверная пагинация

**Файл:** `app/admin/products/page.tsx:9-22`

**Проблема:** `findMany()` без `take/skip` → 500+ товаров в HTML.

**Правка:**
1. Добавить `searchParams.page` и `searchParams.q`.
2. `take: 50, skip: (page-1)*50`.
3. Параллельно `count()` + `findMany` через `Promise.all`.
4. Простой pager внизу таблицы (previous/next + `?page=N`).
5. Опционально — поиск по имени с `where: { name: { contains: q, mode: 'insensitive' } }`.

**Проверка:** открыть `/admin/products?page=2` — показывает следующие 50, общее число видно.

---

### 1.6 Кэш публичных GET-эндпоинтов каталога

**Файл:** `app/api/catalog/products/route.ts` (и аналоги), `app/api/cart/recommendations/route.ts`

**Проблема:** `dynamic = 'force-dynamic'` на всех публичных GET — каждый запрос в БД, нет CDN/браузер-кэша.

**Правки:**
- `/api/catalog/products` (публичный): убрать `force-dynamic`; добавить `export const revalidate = 300`; в ответе поставить `Cache-Control: public, s-maxage=300, stale-while-revalidate=60`.
- `/api/cart/recommendations` (зависит от корзины + сессии): **остаётся dynamic**, но:
  - Общий список `allProducts` вынести в `unstable_cache(fn, ['rec-all-products'], { revalidate: 600, tags: ['products'] })`.
  - Поля делать только те, которые нужны scorer'у.
  - Добавить POST-параметр `cartProductIds` sha-hash для server-side дедупа идентичных запросов от одного клиента (клиентский debounce делаем в 2.5).

**Проверка:** `curl -I /api/catalog/products` показывает `cache-control: public, s-maxage=300`. Вторая загрузка каталога не дергает БД (смотри в логах Prisma).

---

### 1.7 `SessionProvider` — перенести ниже root layout

**Файлы:**
- `app/layout.tsx:97-99` — удаляем обёртку из root.
- Создать `app/account/layout.tsx`, `app/auth/layout.tsx`, `app/checkout/layout.tsx`, `app/admin/layout.tsx` с `SessionProvider` внутри.
- `components/layout/Header.tsx` (UserMenu) — session пробрасывать из серверного layout'а как prop (чтобы `useSession` не дергался на каждой странице).

**Проблема:** `SessionProvider` — это `"use client"`; он оборачивает весь `<body>`, делая все потомки потенциально клиентскими и добавляя RTT к `/api/auth/session`.

**Правка:**
1. `app/layout.tsx` — без SessionProvider; экспорт остальных провайдеров/метаданных как есть.
2. В `(public)/layout.tsx` (или просто в `app/layout.tsx` после удаления) создать серверный Header, который вызывает `await auth()` один раз и передаёт сериализованный session в client-части (`<UserMenu session={...} />`, `<CartButton />` — без сессии).
3. Для страниц, где реально нужны реактивные обновления сессии (account, checkout, auth), оставить SessionProvider в их собственных layout'ах.

**Проверка:**
- Неавторизованный пользователь открывает главную — `/api/auth/session` не дёргается (смотри Network).
- Логин/логаут работает в `/auth/login` — сессия обновляется корректно.
- В админке и /account UserMenu показывает имя пользователя без мигания.

**Риск:** Самый тонкий кусок. Тестировать: (а) гость на главной → нет лишних запросов; (б) логин → UserMenu обновляется; (в) логаут → UserMenu пустой.

---

## 🟠 ФАЗА 2 — HIGH (снижаем latency и заметные косяки)

### 2.1 Header — server + islands

**Файл:** `components/layout/Header.tsx`

**Проблема:** `"use client"` + подписка на cart store дважды → ре-рендер при любом action корзины; `CartDrawer` импортирован синхронно.

**Правки:**
1. Разделить:
   - `HeaderServer.tsx` — Server Component: логотип, навигация, ссылка "В каталог".
   - `HeaderClient.tsx` — только `CartButton` + `UserMenu` + mobile toggle, принимает `session` и `navigation` пропсами.
2. `CartDrawer` вынести в `dynamic(() => import('@/components/cart/CartDrawer'), { ssr: false })`.
3. Mobile-menu state оставляем в `HeaderClient`.

**Проверка:** изменение корзины больше не перерендеривает логотип/nav (React DevTools Profiler).

---

### 2.2 `/admin/blog` и `/admin/reviews` — пагинация

**Файлы:** `app/admin/blog/page.tsx:10-14`, `app/admin/reviews/page.tsx` → DAL `lib/dal/reviews.ts:10-22`.

**Правка:** `take: 50, skip: (page-1)*50` + `count()` + pager. Аналогично 1.5.

---

### 2.3 `getFilterOptions` — `unstable_cache`

**Файл:** `lib/dal/products.ts:329-393`

**Правка:** обернуть всю функцию в `unstable_cache` с `tags: ['catalog-filters']`, `revalidate: 3600`. Инвалидация при create/update/delete товара по тегу.

---

### 2.4 Email-отправка через outbox / неблокирующе

**Файлы:** `app/api/payments/webhook/route.ts:135-138`, `lib/actions/orders.ts:271-273`, `lib/email.ts`

**Проблема:** SMTP 2-5 с блокирует ответ YooKassa; повтор webhook'а; нет pool'а.

**Правка (минимум):**
1. В `lib/email.ts` настроить `pool: true, maxConnections: 3, maxMessages: 50, rateDelta: 1000, rateLimit: 10`.
2. В webhook'ах: отправлять 200 OK **до** запуска email'ов: текущая `Promise.allSettled` уже не awaitится, но важно, чтобы она была вызвана **после** `NextResponse.json(...)`. Если это нельзя (Next возвращает ответ только из `return`), то либо:
   - a) использовать `after()` из `next/server` (Next 15+) для фоновых задач после ответа;
   - b) или писать задачу в `OutboxEvent` с `topic: "email.*"` и обрабатывать через существующий outbox-воркер.
3. Реализовать (a) через `import { after } from 'next/server'`: `after(() => Promise.allSettled([sendPaymentSuccessEmail(...), sendAdminPaymentSuccessEmail(...)]))`.

**Проверка:** webhook отвечает 200 за <100 мс; письма приходят; YooKassa не ретраит.

---

### 2.5 `CartUpsell` — debounce и сетевой кэш

**Файл:** `components/cart/CartUpsell.tsx:32-46`

**Правки:**
1. Текущий `prevKeyRef` защищает от одинаковых подряд, но не debouncit разные изменения. Добавить `setTimeout(..., 300)` + очистка в cleanup useEffect.
2. Запрос кэшировать в ответе: `Cache-Control: private, max-age=30`.

---

### 2.6 `getCollectionsWithProducts` — убрать N+1 на reviews

**Файл:** `lib/dal/collections.ts:37-127` (строки 96-101).

**Правка:** вместо `reviews: { select: { rating: true } }` внутри include — отдельный `groupBy` по `productId` с `_avg.rating, _count` и мержить в JS:
```ts
const averages = await prisma.review.groupBy({
  by: ['productId'],
  where: { isVisible: true, productId: { in: productIds } },
  _avg: { rating: true },
  _count: { _all: true },
})
```

Альтернатива (на будущее): денормализовать `averageRating, reviewCount` в `Product` и апдейтить на add/delete review.

---

### 2.7 `sortByPrice` в `getProducts` — минимизировать трафик

**Файл:** `lib/dal/products.ts:85-124`

**Правка:** шаг 1 (`allWithPrice`) ограничить только `id + price первого варианта`. Текущий код уже это делает, но пересмотреть: можно `prisma.$queryRaw` одной SQL с `MIN(price) OVER (PARTITION BY product_id)` и `ROW_NUMBER()` для пагинации за один roundtrip.

Реализация минимального фикса: оставить как есть, но протестировать EXPLAIN ANALYZE. Если тормозит на крупной базе — переписать на raw SQL.

---

### 2.8 `UserMenu` — сессия через props

**Файлы:** `components/layout/UserMenu.tsx:9`, `components/layout/HeaderClient.tsx` (новый).

**Правка:** вместо `useSession` на каждой странице, серверный Header передаёт `session` props'ом; `UserMenu` рендерится как client только для dropdown'а. `useSession` оставляем только внутри `/account/*`, где интерактив важен.

---

## 🟡 ФАЗА 3 — MEDIUM (полировка)

### 3.1 `CartButton` — снять hydration-riск

`components/cart/CartButton.tsx:13` — обернуть счётчик в компонент с `suppressHydrationWarning` на `<span>`.

### 3.2 `sitemap.ts` — кэширование

`app/sitemap.ts:43-52` — обернуть выборки slugов в `unstable_cache({ revalidate: 86400 })`.

### 3.3 `/admin/page.tsx` (dashboard) — кэш recentOrders

Обернуть `recentOrders` в `unstable_cache` на 60 с.

### 3.4 `app/admin/products/[id]/page.tsx:22` — кэш `getAllCollections`

Обернуть в `unstable_cache` на 300 с с тегом `collections`.

### 3.5 `app/admin/orders/[id]/page.tsx:14` — `statusLogs` через `include`

Убрать второй отдельный запрос — добавить `statusLogs: { orderBy: { createdAt: "desc" } }` в `getOrderById`.

### 3.6 `lib/actions/images.ts:8` — лимит размера файла

Добавить `if (file.size > 10 * 1024 * 1024) throw new Error("Файл больше 10 МБ")` перед `arrayBuffer()`.

### 3.7 API responses — `Cache-Control`

Везде в публичных GET API, где убрали `force-dynamic`, добавить заголовок `Cache-Control`.

### 3.8 Звёзды рейтинга — стабильный key

`components/sections/Products.tsx:132` — `key={`star-${product.id}-${i}`}` или рендерить через `[1..N].map` с id.

### 3.9 `StickyMobileCTA` — suppressHydrationWarning

`components/home/StickyMobileCTA.tsx:14-18` — wrap root в div с suppressHydrationWarning или перенести sessionStorage-check в `onMount`.

### 3.10 `ProductGallery` — `loading="lazy"` на thumbnails

`components/product/ProductGallery.tsx:40-51, 60-71` — добавить `loading="lazy"` если не primary.

---

## 🟢 ФАЗА 4 — STRATEGIC (архитектурные)

1. **Денорм `Product.averageRating, reviewCount, minPrice`** — триггерами или в actions (review create/delete, variant create/update). Снимает тонну JOIN'ов и агрегатов.
2. **Полнотекстовый поиск по Order/Product** — `tsvector` + GIN-индекс если объём запросов растёт.
3. **Структурированный логгер** (pino) вместо `console.*` — ускорит hot-path API.
4. **Outbox-воркер для email'ов** — вместо `after()`, если объём писем растёт.
5. **Rate-limit на webhook'ах** (`/api/webhooks/*`) — простой in-memory counter на IP+topic.
6. **ISR для `/catalog/[slug]`** (когда разъединим с `auth()`): оставить session только для блока "добавить в избранное" как клиентский island.
7. **Footer год** `Footer.tsx:23` → `new Date().getFullYear()`.

---

## ✅ Порядок выполнения и commits

| Фаза | Пункт | Commit message |
|------|-------|----------------|
| 1 | 1.1 | `perf(db): add hot-path indexes for product/order/article/review` |
| 1 | 1.2 | `perf(dal): aggregate shop stats at DB instead of findMany+reduce` |
| 1 | 1.3 | `perf(cache): replace revalidatePath('/') with tagged unstable_cache` |
| 1 | 1.4 | `perf(admin): push stock-snapshot filters to SQL` |
| 1 | 1.5 | `perf(admin): paginate /admin/products` |
| 1 | 1.6 | `perf(api): cache public catalog GET with s-maxage` |
| 1 | 1.7 | `perf(layout): move SessionProvider out of root` |
| 2 | 2.1 | `perf(header): split into server + client islands` |
| 2 | 2.2 | `perf(admin): paginate blog and reviews` |
| 2 | 2.3 | `perf(dal): cache getFilterOptions` |
| 2 | 2.4 | `perf(email): pool + non-blocking after() in webhook` |
| 2 | 2.5 | `perf(cart): debounce upsell recommendations` |
| 2 | 2.6 | `perf(dal): groupBy avg rating for collections` |
| 2 | 2.7 | `perf(dal): minimize trafik on sortByPrice branch` |
| 2 | 2.8 | `perf(header): session via props instead of useSession` |
| 3 | 3.x | `perf: polish (sitemap cache, image lazy, key stability)` |

После всех фаз — единый финальный коммит: `chore: complete perf-audit-2026-04-20 sprint` и push.

---

## 📊 Ожидаемые эффекты

- **LCP главной:** −250–500 мс (Session вне root + кэш на stats/featured).
- **P95 `/catalog`:** −40 % (кэш + индексы).
- **`/admin/products`:** рендер с 3–5 с до 200–400 мс (пагинация).
- **YooKassa webhook:** p95 latency с 2–5 с до <200 мс (non-blocking email).
- **БД queries/min на каталог:** −60 % (кэш + индексы).

---

## 🚢 Деплой

1. `git add -A && git commit` для каждой фазы.
2. Финальный `git push origin main`.
3. На сервере beget: `git pull && npx prisma migrate deploy && npm run build && pm2 restart millor`.
