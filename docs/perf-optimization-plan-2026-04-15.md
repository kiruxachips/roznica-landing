# План оптимизации производительности — 2026-04-15

Глубокий пошаговый план исправления проблем, выявленных в аудите производительности от 2026-04-15. Приоритеты: **Critical → High → Medium → Strategic**.

Каждый пункт содержит: **файл**, **что делаем**, **почему**, **как проверить**, **риски**.

---

## 📋 ПРИНЦИПЫ И ОГРАНИЧЕНИЯ

1. **Деплой только через GitHub** (см. memory `feedback_deploy_flow.md`). После каждой фазы — отдельный коммит для удобного отката.
2. **Shared server (beget)** → нет Redis, нет Edge Runtime. Сосредоточимся на bundle, изображениях, кеше Next.js.
3. **`auth()` в page** делает страницу dynamic автоматически. На страницах с `auth()` `revalidate` работать не будет без рефакторинга. Это влияет на `/catalog`, `/catalog/[slug]`.
4. **Не ломаем функциональность.** Каждая фаза прогоняется через `npm run build` локально перед коммитом.

---

## 🔥 ФАЗА 1 — CRITICAL (Bundle, изображения, рендеринг)

### 1.1 Замена тяжёлых JPG в `About.tsx` на оптимизированный формат

**Файл:** `components/sections/About.tsx:73-108`
**Проблема:** 4 фотографии (`1.jpg`–`4.jpg`) суммарно ~12.6 МБ. Используются как декорация на главной — каждый посетитель скачивает их.
**Замеры:**
- `1.jpg` 2.4M, `2.jpg` 4.5M, `3.jpg` 3.3M, `4.jpg` 3.1M

**Шаги:**
1. Сжать через `sharp` (CLI или скрипт) в WebP при 1200×1200 q80 → ~150-300KB каждое. Сохранить как `about-1.webp` ... `about-4.webp` в `/public/images/`.
2. Обновить `<Image>` в `About.tsx`:
   - `src="/images/about-1.webp"` (etc.)
   - Добавить `sizes="(max-width: 1024px) 50vw, 25vw"`
   - `quality={80}`
   - `loading="lazy"` (по умолчанию у `Image` без `priority`)
3. Удалить старые `1.jpg–4.jpg` после деплоя и проверки.

**Проверка:** В Chrome DevTools → Network → Img: размер 4 фото суммарно <1MB вместо 12MB.
**Риски:** Низкие. Image оптимизатор Next.js сам достанет AVIF/WebP, но раздавать гигантский JPG как источник — расточительно.

---

### 1.2 Чистка `/public/images/` от дубликатов PNG

**Файлы:** `/public/images/`
**Проблема:** Лежат и `bourbon NY.png` (2.7M), и `bourbon.webp` (264K). PNG никем не используются (grep подтверждает — только webp в коде).

**Шаги:**
1. Подтвердить через `grep -r "NY.png\|brazil bourbon\|brazil santos\|peru.png\|peru NY" --include="*.{ts,tsx,js,mjs,json}"` что PNG нигде не подключены.
2. Удалить:
   - `bourbon NY.png`, `peru NY.png`, `santos NY.png` (2.4–2.7M каждый)
   - `brazil bourbon.png`, `brazil santos.png`, `peru.png` (~2.8M каждый)
3. Закоммитить удаление.

**Проверка:** `du -sh public/images/` → -16-17 MB.
**Риски:** Если PNG куда-то импортирован — сборка упадёт. Поэтому grep сначала.

---

### 1.3 Включить `optimizePackageImports` для `lucide-react` + image формата AVIF

**Файл:** `next.config.js`
**Проблема:** Lucide импортируется именованно (`import { X, MapPin } from "lucide-react"`), но без `optimizePackageImports` Next.js всё равно тащит лишнее. AVIF не включён — теряем 20-30% сжатия.

**Изменения:**
```js
const nextConfig = {
  output: 'standalone',
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 дней
    remotePatterns: [
      { protocol: 'https', hostname: 'millor-shop.ru' },
    ],
  },
  serverExternalPackages: ['sharp'],
  // headers — без изменений
}
```

**Проверка:** `npm run build` → в `.next/static/chunks` бандл главной должен уменьшиться. Network → формат `image/avif`.
**Риски:** AVIF медленнее декодируется на старых устройствах, но Next сам выбирает по `Accept` — fallback на WebP.

---

### 1.4 Убрать `force-dynamic` где не нужен (blog)

**Файлы:**
- `app/blog/page.tsx:1` — нет `auth()`, можно ISR
- `app/blog/[slug]/page.tsx:1` — нет `auth()`, есть `generateStaticParams`, можно ISR

**НЕ трогаем:**
- `/catalog/page.tsx` — использует `auth()` для favorites → останется dynamic, но `force-dynamic` уберём (избыточно).
- `/catalog/[slug]/page.tsx` — то же самое.
- `/admin/*` — оставляем `force-dynamic` (правильно).
- `/account/*`, `/auth/*`, `/cart`, `/checkout`, `/thank-you`, API routes — каждый смотрим отдельно.

**Шаги:**
1. `app/blog/page.tsx`: заменить `export const dynamic = "force-dynamic"` на `export const revalidate = 300` (5 мин).
2. `app/blog/[slug]/page.tsx`: заменить на `export const revalidate = 3600` (1 час) + проверить, что `incrementArticleViewCount` не блокирует ISR (вызвать через `unstable_after` или Server Action, либо вынести в API). Если рефакторинг дороже выгоды → пока оставляем `force-dynamic`.
3. `/catalog/page.tsx`: убрать `force-dynamic` (auth() сам сделает dynamic).
4. `/catalog/[slug]/page.tsx`: убрать `force-dynamic` (auth() то же).

**Проверка:** `npm run build` → в выводе билда `/blog` должен показывать `ƒ` (dynamic) → `○` или `●` (static/ISR).
**Риски:** Главный риск — `incrementArticleViewCount`. Если он внутри page() рендера → блокирует кеш. Нужно изолировать.

---

### 1.5 Lazy-load TipTapEditor в админке

**Файл:** `components/admin/ArticleForm.tsx:6` (импортирует `TipTapEditor`)
**Проблема:** TipTap (~500КБ gz) попадает в общий админ-бандл. `/admin/orders`, `/admin/products` грузят его впустую.
**Решение:** `next/dynamic` с `ssr: false`.

**Шаги:**
1. В `ArticleForm.tsx` заменить:
```tsx
import { TipTapEditor } from "./TipTapEditor"
```
на:
```tsx
import dynamic from "next/dynamic"
const TipTapEditor = dynamic(
  () => import("./TipTapEditor").then(m => m.TipTapEditor),
  { ssr: false, loading: () => <div className="min-h-[400px] rounded-lg border bg-muted/20 animate-pulse" /> }
)
```
2. Убедиться, что `ArticleForm` сам — Client Component (он уже `"use client"`), значит динамический импорт корректен.

**Проверка:** Открыть `/admin/orders`, в DevTools Network → нет `tiptap` чанка. Открыть `/admin/blog/[id]` → чанк подгружается.
**Риски:** Низкие. ArticleForm используется только в редакторе статей.

---

### 1.6 Оптимизация Yandex Maps loader

**Файл:** `components/sections/CoffeeShopsMap.tsx:84-96, 105-160`
**Проблема:**
- Скрипт грузится через `document.createElement` без `defer`.
- При смене города `initMap()` уничтожает карту и пересоздаёт с нуля (200-400ms лаг).

**Шаги:**
1. **Кеш карты при смене города:** разделить логику на `initMap()` (один раз создаёт `YMap` + слои) и `updateMarkers(city)` (обновляет центр через `map.update({ location })` и diff маркеров через `markersRef`).
2. **Скрипт:** оставить `document.createElement`, но добавить `script.defer = true`. (next/script на клиенте через useEffect не даст преимуществ.)
3. **Error UI:** если `fetch("/api/delivery/settings")` падает — показать сообщение, а не вечный спиннер.

**Проверка:** Открыть карту, переключить города 5 раз → визуально без лагов. DevTools Performance: `update` < 50ms.
**Риски:** Регрессия логики маркеров. Тестируем все три города и выбор магазина.

---

## ⚡ ФАЗА 2 — HIGH (Network, кеш, мелкие баги)

### 2.1 Cache-Control для статики `/images/*` и `/uploads/*`

**Файл:** `next.config.js` (блок `headers()`)
**Шаги:** Добавить в `headers()`:
```js
{
  source: '/images/:path*',
  headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }]
},
{
  source: '/uploads/:path*',
  headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }]
},
```
**Проверка:** Network → response headers содержат `cache-control: public, max-age=31536000, immutable` для `/images/*`.

---

### 2.2 Preconnect / dns-prefetch к Yandex CDN и Metrika

**Файл:** `app/layout.tsx` (внутри `<html>` или `<head>` через `<link>` теги)
**Шаги:** Добавить в `<head>` (через `metadata.other` или прямо в JSX):
```tsx
<link rel="preconnect" href="https://mc.yandex.ru" crossOrigin="" />
<link rel="dns-prefetch" href="https://api-maps.yandex.ru" />
<link rel="dns-prefetch" href="https://yastatic.net" />
```
Поместить в `<head>` через JSX в `RootLayout`.
**Проверка:** Network → DNS resolution для yandex.ru начинается раньше.

---

### 2.3 Фикс `loadMore` в `ProductGrid.tsx` — стабильные deps

**Файл:** `components/catalog/ProductGrid.tsx:43-71, 74-87`
**Проблема:** `loadMore` зависит от `searchParams` (объект из props, может быть новый reference на каждый рендер). IntersectionObserver пересоздаётся при каждом изменении.

**Шаги:**
1. Сериализовать `searchParams` через `useMemo`:
```tsx
const searchParamsKey = useMemo(
  () => searchParams ? new URLSearchParams(searchParams as Record<string, string>).toString() : "",
  [searchParams]
)
```
2. В `loadMore` использовать `searchParamsKey` вместо объекта.

**Проверка:** В DevTools → счётчик IntersectionObserver instances не растёт при скролле.

---

### 2.4 Удалить `console.error` в production

**Файлы:** `lib/delivery/*.ts`, `lib/actions/*.ts`, `app/api/**/*.ts` — где есть `console.error/log/warn`.
**Шаги:**
1. `grep -rn "console\.\(error\|log\|warn\)" lib/ app/api/`
2. Заменить на хелпер `lib/log.ts`:
```ts
export const log = {
  error: (...args: unknown[]) => { if (process.env.NODE_ENV !== 'production') console.error(...args) },
  warn:  (...args: unknown[]) => { if (process.env.NODE_ENV !== 'production') console.warn(...args) },
}
```
Либо просто `if (process.env.NODE_ENV !== 'production') console.error(...)` inline.

**Риски:** Потеря логов критических ошибок в production. Альтернатива — оставить error-логи как есть, чистить только debug log/warn.

---

### 2.5 Lazy-импорт `fast-xml-parser` в `pochta.ts`

**Файл:** `lib/delivery/pochta.ts`
**Шаги:** Заменить top-level `import { XMLParser } from "fast-xml-parser"` на динамический внутри функции:
```ts
async function parseXml(xml: string) {
  const { XMLParser } = await import("fast-xml-parser")
  return new XMLParser().parse(xml)
}
```
**Проверка:** В `.next/server` чанк pochta — без `fast-xml-parser` в основном bundle.

---

## 🛠 ФАЗА 3 — MEDIUM (UX, robustness, мелкие выигрыши)

### 3.1 Error boundary + error UI в `CoffeeShopsMap`
**Файл:** `components/sections/CoffeeShopsMap.tsx`
Добавить state `error`, показывать сообщение если `/api/delivery/settings` не отдал ключ или Yandex Maps не загрузился за 10 секунд. Кнопка «Повторить».

### 3.2 `loading.tsx` для /catalog, /blog, /catalog/[slug]
**Файлы:** `app/catalog/loading.tsx`, `app/blog/loading.tsx`, `app/catalog/[slug]/loading.tsx`
Скелетоны вместо белого экрана.

### 3.3 Prisma `include` → `select` в DAL
**Файлы:** `lib/dal/collections.ts`, `lib/dal/products.ts`, `lib/dal/articles.ts`
Аудит и замена `include` на `select` с явным списком полей. Цель — минус 20-40% размера запросов.

### 3.4 `middleware.ts` matcher — исключить статику
Уже исключена через matcher (только `/admin`, `/account`, `/auth`). Доп. проверка: убедиться, что `_next/static`, `favicon.ico`, sitemap не подпадают. (Уже OK, оставить как заметку.)

### 3.5 Hero `will-change` для blur элементов
**Файл:** `components/sections/Hero.tsx:11-12`
Добавить `style={{ willChange: "filter" }}` (sparingly — только если профайлер показывает jank).

### 3.6 Bundle analyzer
Установить `@next/bundle-analyzer`, добавить script `analyze`. Базовое измерение перед/после оптимизаций.

---

## 🏛 ФАЗА 4 — STRATEGIC (1+ день каждое)

### 4.1 Refactor /catalog & /catalog/[slug] для ISR
Вынести `favorited` логику в Client Component с useEffect → API. Тогда страница станет статической.

### 4.2 Sharp pipeline на upload (AVIF + blurhash)
Дополнить `lib/storage/local.ts` — конвертировать в AVIF, генерировать blurhash placeholder для `<Image placeholder="blur">`.

### 4.3 Web Vitals → Yandex Metrika
Через `useReportWebVitals` отправлять `LCP/CLS/FCP/INP/TTFB` в Метрику для measure-первого подхода.

### 4.4 Audit всех `'use client'` (сейчас 28 файлов)
Каждый компонент: реально нужен ли client? Серверные могут быть async и предзагружать данные.

### 4.5 In-memory LRU кеш над DAL
`lib/dal/cache.ts` — обёртка с TTL для часто читаемых getProducts/getCollections. Инвалидация через server actions.

---

## ✅ ПОРЯДОК ИСПОЛНЕНИЯ И КОММИТОВ

| Фаза | Ожидаемое время | Коммит |
|------|-----------------|--------|
| 1.1 + 1.2 | 30 мин | `perf: optimize About images, drop heavy PNG dups` |
| 1.3 | 5 мин | `perf: enable AVIF + lucide optimizePackageImports` |
| 1.4 | 15 мин | `perf: drop force-dynamic where unnecessary` |
| 1.5 | 10 мин | `perf: lazy-load TipTap editor in admin` |
| 1.6 | 30 мин | `perf: reuse Yandex map instance, defer script` |
| 2.1 | 5 мин | `perf: long Cache-Control for /images and /uploads` |
| 2.2 | 5 мин | `perf: preconnect to Yandex hosts` |
| 2.3 | 10 мин | `perf: stable deps in ProductGrid loadMore` |
| 2.4 | 15 мин | `chore: silence dev-only console logs in prod` |
| 2.5 | 5 мин | `perf: lazy-import fast-xml-parser` |
| Фаза 3 | по необходимости | отдельные коммиты |
| Фаза 4 | планируем отдельно | отдельная сессия |

После каждой фазы:
1. `npm run build` локально — нет ошибок.
2. Открыть страницу, визуально проверить.
3. Коммит → push на GitHub → деплой через `ssh beget && git pull && npm run build && pm2 restart`.

---

## 🎯 ОЖИДАЕМЫЙ ЭФФЕКТ (грубо, без замеров)

- **LCP** главной: -300-500ms (за счёт изображений About + удаления мёртвых PNG из CDN raw)
- **TTI** админки `/admin/orders`: -400-500KB JS (TipTap)
- **Bundle landing**: -40-80KB (lucide, формат AVIF)
- **Smooth UX** карты: 200-400ms лаг при смене города → <50ms
- **Repeat visits**: instant (immutable cache)

Все эффекты валидируем через `npm run build` отчёт + Chrome DevTools Performance / Lighthouse.
