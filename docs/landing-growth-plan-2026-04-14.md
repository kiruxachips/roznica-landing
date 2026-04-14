# План реализации: точки роста главной страницы

**Дата:** 2026-04-14
**Scope:** 6 фич для главной страницы (`app/page.tsx`) + поддерживающая инфраструктура.
**Non-goals:** Редизайн страниц каталога/карточки товара, админка подписки, backend подписки, A/B тесты.

---

## Обзор фич

| # | Фича | Тип | Зависимости |
|---|---|---|---|
| F4 | Social proof strip | Static UI | — |
| F5 | Category tiles «Для способа» | Static UI | brewing SVGs есть |
| F7 | Sticky mobile CTA | Client component | IntersectionObserver |
| F6 | Featured blog on home | SSR section | существующий DAL `getArticles` |
| F3 | Freshness transparency badge | DB setting + API + UI | новое поле в `SiteSetting` |
| F1 | Taste quiz | Client flow + scoring API | использует существующие поля продукта |

**Порядок реализации:** F4 → F5 → F7 → F6 → F3 → F1 (от простого к сложному, каждая фича независима).

---

## Архитектурные решения

### Иерархия секций главной (после)

```
<Hero />
<SocialProofStrip />          ← F4 NEW
<FreshnessBadge />            ← F3 NEW (внутри Hero или отдельной полоской)
<CategoryTiles />             ← F5 NEW
<Features />
<Products />
<TasteQuiz />                 ← F1 NEW
<About />
<Testimonials />
<FeaturedBlog />              ← F6 NEW
<Contact />
<StickyMobileCTA />           ← F7 NEW (fixed, портально не нужен)
```

### Новые файлы

```
components/home/
  SocialProofStrip.tsx        (F4)
  CategoryTiles.tsx           (F5)
  StickyMobileCTA.tsx         (F7)
  FeaturedBlog.tsx            (F6)
  FreshnessBadge.tsx          (F3)
  TasteQuiz.tsx               (F1 — оркестратор)
  quiz/
    QuizStep.tsx              (F1 — шаг)
    QuizResult.tsx            (F1 — финальный экран с 3 карточками)
    questions.ts              (F1 — конфиг вопросов)
    scoring.ts                (F1 — алгоритм матчинга)

app/api/
  freshness/route.ts          (F3)
  quiz/match/route.ts         (F1)

lib/dal/
  site-settings.ts            (F3 — getFreshnessInfo)
```

### Изменения схемы (минимум)

```prisma
// prisma/schema.prisma — расширяем существующий SiteSetting либо добавляем,
// если его нет — проверяем при имплементации

model SiteSetting {
  id              String   @id @default(cuid())
  key             String   @unique
  value           String
  updatedAt       DateTime @updatedAt
}
```

Ключи:
- `last_roast_date` — ISO-дата последней обжарки (формат `YYYY-MM-DD`)
- `reviews_count` — строка число (для social proof)
- `rating_value` — строка `4.9`
- `orders_shipped` — строка число

Если таблица `SiteSetting` уже есть — используем, если нет — создаём миграцию. Фолбэк: если в БД пусто, отдаём дефолты из константы.

---

## F4 — Social Proof Strip

### Цель
Узкая полоса сразу под Hero с ключевыми метриками доверия.

### UI
```
[★ 4.9 · 2 480 отзывов]  [12 400+ клиентов]  [🚚 СДЭК · Почта · Курьер]  [🔒 Оплата ЮKassa]
```
Десктоп: в один ряд, центрировано. Mobile: horizontal scroll.

### Компонент
`components/home/SocialProofStrip.tsx` — Server Component, принимает пропсы `{ rating, reviewsCount, ordersShipped }`. В главной странице хардкодим значения на первом этапе (потом подхватим через F3 из `SiteSetting`).

### Acceptance
- Высота ≤ 64px на desktop, ≤ 88px на mobile
- На mobile — горизонтальный скролл без видимого scrollbar
- Иконки унифицированы (w-5 h-5 strokeWidth 1.75)

---

## F5 — Category Tiles «Для какого способа»

### Цель
Упростить путь «что купить» для newbie — выбор через способ заваривания.

### Данные
Используем существующие ассеты из `public/images/brewing/`:
`ecspresso.svg`, `french.svg`, `moka.svg`, `tyrka.svg`, `voronka.svg`, `aero.svg`, `cup.svg`, `automat.svg`.

Маппинг на фильтр каталога `?brewing=<method>`:
| Иконка | Название | brewing slug |
|---|---|---|
| ecspresso | Для эспрессо | `espresso` |
| voronka | Для фильтра | `filter` |
| tyrka | Для турки | `turka` |
| french | Для френч-пресса | `french-press` |
| moka | Для моки | `moka` |
| aero | Для аэропресса | `aeropress` |

### UI
6 тайлов в `grid-cols-3 sm:grid-cols-6`. Каждый тайл: квадрат с иконкой сверху + подписью. Ховер — заливка primary, инверт иконки (как в BrewingGuides).

### Компонент
`components/home/CategoryTiles.tsx` — Server Component. Секция с заголовком «Подберите кофе под ваш способ».

### Acceptance
- Клик ведёт на `/catalog?brewing=<slug>`
- Визуально согласован с `BrewingGuides` (одинаковые иконки/стиль)
- Mobile: 3 колонки; на 640+ 6 колонок

---

## F7 — Sticky Mobile CTA

### Цель
Постоянный путь в каталог при скролле на мобиле.

### Поведение
- Виден только на mobile (`md:hidden`)
- Появляется **после** скролла ниже Hero (IntersectionObserver на Hero секцию)
- Скрывается когда в viewport `#contact` (чтобы не дублировать конечный CTA)
- Не показывать на страницах `/catalog/*`, `/cart`, `/checkout`, `/account/*` (компонент только на главной)

### UI
Фиксированная плашка снизу, полная ширина. Левая часть — иконка кофе + текст «От 550₽ · свежая обжарка». Правая часть — кнопка «Выбрать кофе →».

### Компонент
`components/home/StickyMobileCTA.tsx` — Client Component.
```tsx
"use client"
// IntersectionObserver на #hero + #contact
// state: visible = !heroVisible && !contactVisible
```

### Acceptance
- Плавное появление (translate-y transition 300ms)
- Touch target ≥ 48px высоты
- Не перекрывает важные элементы (z-40)
- Респектит safe-area-inset-bottom

---

## F6 — Featured Blog on Home

### Цель
Интегрировать блог в воронку главной: SEO + образование + cross-links.

### Данные
Существующий DAL: `getArticles({ limit: 3, page: 1 })` — вернёт последние 3 статьи.

### UI
Секция с заголовком «Читайте о кофе» + ссылка «Все статьи →».
Grid 1/2/3 колонки (mobile/tablet/desktop) из существующих `ArticleCard`.

### Компонент
`components/home/FeaturedBlog.tsx` — Server Component.
```tsx
export async function FeaturedBlog() {
  const { articles } = await getArticles({ limit: 3, page: 1 })
  if (articles.length === 0) return null
  return <section>...</section>
}
```

### Acceptance
- Если статей < 3 — показываем столько сколько есть (min 1, иначе null)
- Ссылки внутри рендерятся через существующий `ArticleCard`
- Размещение: **перед** `Contact`

---

## F3 — Freshness Transparency

### Цель
Подтверждать уникальное преимущество «свежая обжарка» фактическими датами.

### Архитектура

#### Хранение
Ключ `last_roast_date` в `SiteSetting` (создаём таблицу если её нет). Тип строка ISO-даты.

**Проверка шаг 0:** Посмотреть существующие таблицы в `prisma/schema.prisma`. Если `SiteSetting` уже есть — reuse; если нет — создать миграцию `add_site_settings`.

#### API
`GET /api/freshness` → `{ lastRoastDate: "2026-04-13", nextShipmentDate: "2026-04-15" }`
- `lastRoastDate` — из БД или дефолт (сегодня − 1 день)
- `nextShipmentDate` — `lastRoastDate + 1 рабочий день` (простая функция `addBusinessDays`)

#### Админка
Минимальная: добавить поле в существующую админскую настройку или новую страницу `/admin/freshness` с одним инпутом date + кнопка «Обновить обжарку сегодня» (ставит текущую дату).

**Упрощение:** На первой итерации админ-редактирование можно пропустить и использовать константу в коде. Добавить полноценный edit во второй итерации, когда станет ясно кто ведёт.

### UI
```
🔥 Последняя обжарка: вчера, 13 апреля  ·  📦 Ближайшая отправка: завтра
```
Размещение: полоска между Hero и SocialProof, или бейдж внутри Hero выше CTA.

### Компонент
`components/home/FreshnessBadge.tsx` — Server Component, читает из `getFreshnessInfo()` DAL.

Форматирование дат на русском: `вчера` / `сегодня` / `завтра` / `DD месяца`. Утилита `formatRelativeDate`.

### Acceptance
- Если `lastRoastDate` не в БД — использовать дефолт (сегодня − 1 день)
- Дата всегда в прошлом или сегодня (валидация в API)
- Mobile: компактно одной строкой через `·`; если не влезает — две строки

---

## F1 — Taste Quiz

### Цель
Персонализировать выбор. Снижает paradox of choice для новичков.

### Flow
```
Intro → Q1 → Q2 → Q3 → Q4 → Q5 → Результат (3 карточки)
```
5 вопросов. Прогресс-бар. Назад-кнопка. На результате — «Пересдать тест».

### Вопросы (см. `questions.ts`)
1. **Способ заваривания:** Эспрессо / Фильтр / Турка / Френч-пресс / Аэропресс / Мока / Пока не выбрал
2. **Вкусовой профиль:** Сладкий/шоколадный / Яркий фруктовый / Ореховый классический / Пока не знаю
3. **Крепость:** Помягче / Сбалансированный / Крепкий
4. **Кислотность:** Минимум / Средняя / Люблю яркую
5. **Бюджет за 1 кг:** До 1500 / 1500-2500 / Не важно

### Scoring Algorithm
Функция `scoreProduct(product, answers) → number` считает сумму весов совпадений:

```
score = 0
+ (brewing in product.brewingMethods) ? +30 : 0
+ flavorMatch(answers.flavor, product.flavorNotes) [0..25]
+ strengthMatch(answers.strength, product.roastLevel, product.body) [0..15]
+ acidityMatch(answers.acidity, product.acidity) [0..15]
+ priceMatch(answers.budget, product.minPrice) [0..15]
= max 100
```

Возвращаем top 3 с `score >= 40`. Если меньше 3 — добираем по общему рейтингу.

### Вопросы-маппинг — детали

- **flavorMatch:** для `sweet` — ищем ноты «шоколад», «карамель», «орех». Для `fruity` — «ягод», «цитрус», «яблок». Для `nutty` — «орех», «какао».
- **strengthMatch:** `light` → `roastLevel in ["Светлая", "Средняя"]` + `body <= 50`. `medium` → `["Средняя"]`. `strong` → `["Тёмная"]` + `body >= 60`.
- **acidityMatch:** прямая корреляция `acidity` поля продукта (0-100) и выбранного уровня.

### API
`POST /api/quiz/match` body `{ brewing, flavor, strength, acidity, budget }` → `{ products: ProductCard[] }`
Возвращает 3 продукта в формате существующего `ProductCard` типа.

### Компонент-структура
```
TasteQuiz.tsx              — контейнер, state-machine
├── QuizIntro.tsx          — стартовый экран
├── QuizStep.tsx           — универсальный шаг с вариантами
├── QuizProgress.tsx       — прогресс-бар
├── QuizResult.tsx         — 3 карточки + CTA «Посмотреть все»
└── questions.ts           — конфиг массив
```

### State
`useState` + `useReducer` для истории ответов. Локально, без persist.

### UI/UX
- Хороший визуал: крупные тап-таргеты (карточки-варианты с иконкой)
- Анимация перехода между шагами (fade + slide)
- На результате показываем совпадение в % для каждого товара («Идеально вам на 87%»)

### Acceptance
- 5 шагов, валидация на каждом (нельзя next без ответа)
- Результат всегда возвращает минимум 1 товар
- Mobile-first: шаги полноэкранные на мобиле, по центру на десктопе
- Пересдача: сбрасывает state

---

## Общие требования

### Стиль
- Следуем существующей дизайн-системе: `font-serif` заголовки, `primary`-цвет коричневый, кнопки `buttonVariants`, отступы секций `py-16 sm:py-20 lg:py-28`.
- Все иконки: `strokeWidth={1.75}`, `w-5 h-5` для интерактивных элементов.

### Производительность
- F6 (блог) — SSR, т.к. Server Component с cache
- F3 — добавить `revalidate = 60` на API route (1 мин)
- F1 — клиентский, API вызов только в самом конце

### Аналитика (вне скоупа этого PR, но место для хуков)
- Quiz: события `quiz_start`, `quiz_step`, `quiz_complete`, `quiz_cta_click`
- Sticky CTA: `sticky_cta_click`
- Category tiles: `category_tile_click` с `brewing`
- Комменты-маркеры в коде `// TODO: analytics: <event>`

### Accessibility
- Все интерактивные элементы — доступны с клавиатуры
- Quiz — `role="radiogroup"` на шагах
- Sticky CTA — `role="complementary"`, `aria-label`

### Testing
- Manual QA checklist после каждой фичи (chrome mobile, desktop, iPhone sim)
- `npm run build` + `tsc --noEmit` после всех фич
- `npm run lint` чисто

---

## Порядок коммитов

1. `feat(home): add social proof strip` (F4)
2. `feat(home): add brewing category tiles` (F5)
3. `feat(home): add sticky mobile CTA` (F7)
4. `feat(home): feature latest articles on home` (F6)
5. `feat(home): add freshness transparency badge` (F3)
   - sub-commit: `feat(db): add SiteSetting table` если нужно
6. `feat(home): add taste quiz` (F1)
   - `feat(api): quiz matching endpoint`

Каждый коммит — деплой на beget через `git push → pull → docker compose up -d --build app`.

---

## Risks / Open Questions

1. **SiteSetting table** — существует ли? Проверить `prisma/schema.prisma` перед F3. Если нет — миграция.
2. **Tests** — нет настроенного Jest/Vitest. Полагаемся на TS + manual QA.
3. **Quiz scoring** может выдавать <3 совпадений при малом каталоге — фолбэк на общий рейтинг.
4. **Sticky CTA + CookieBanner** — оба fixed bottom. Проверить z-index и взаимное перекрытие; если cookie принят — StickyCTA начинает показываться ниже hero как обычно.
5. **Freshness**: если забудут обновить `last_roast_date` — отдаём «вчера» как fallback. Нужна отметка в админке «устарело?» — на будущую итерацию.

---

## Готовность к старту

✅ План согласован.
▶️ Начинаем с F4 (Social Proof Strip) как самой простой и изолированной фичи.
