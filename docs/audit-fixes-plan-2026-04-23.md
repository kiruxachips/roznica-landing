# План фиксов по аудиту — 2026-04-23

## Контекст

После deploy-а пяти P0/P1/P2 правок (thank-you copy, favorites, drag-scroll, guest tracking, pickup points) провёл сквозной аудит четырьмя параллельными агентами (public UX, auth/аккаунт, админ/интеграции, security/БД/perf). Все ключевые находки сверены с реальным кодом, ложные срабатывания отсеяны.

Этот документ — единый источник правды для следующего спринта: что, где, почему, в каком порядке, как верифицировать. После одобрения плана — выполняем пошагово отдельными коммитами, начиная с P0.

Итого к закрытию: **8 × P0**, **14 × P1**, **13 × P2**, **9 × Недоделок**.

---

## Принципы приоритизации

- **P0** — реальная дыра в безопасности или угроза данным/платежам. Фиксим в первую очередь, до любых фич.
- **P1** — функциональный баг, видимый пользователю или админу, или дорогой race/leak, который будет кусаться на проде.
- **P2** — UX-полировка, a11y, локальные улучшения качества кода.
- **Недоделки** — полуготовые фичи: либо доделать, либо явно убрать из UI/скоупа.

Комми́ты — маленькими пачками, 1 логическая правка = 1 коммит. Безопасные миграции (аддитивные NULLABLE, новые индексы CONCURRENTLY) можно применять прямо на проде; структурные — только в maintenance-окне.

---

# Этап 1 — P0 (security + данные)

## P0-1. XSS в блоге через `article.content`

**Где:** `app/blog/[slug]/page.tsx:155` — `dangerouslySetInnerHTML={{ __html: article.content }}` без санитизации.

**Почему опасно:** TipTap в админке может пропустить вредоносный HTML (баг редактора, компрометация аккаунта менеджера, любой `img onerror`). Полезная нагрузка выполнится у каждого посетителя статьи, украдёт сессионные cookies (хотя JWT — httpOnly; но `localStorage` / CSRF-token достижимы).

**Что делаем:**
1. `npm i isomorphic-dompurify`.
2. На сервере перед рендером прогонять `article.content` через `DOMPurify.sanitize(content, { USE_PROFILES: { html: true } })`.
3. Whitelist тегов/атрибутов: разрешить `h1-h6, p, strong, em, u, ul, ol, li, blockquote, a (href/target), img (src/alt/width/height), figure, figcaption, code, pre, br, hr, table, thead, tbody, tr, td, th`. Запретить `script, iframe, object, embed, on*=`.
4. Проверить также `articleCategory.description` и `article.excerpt` если рендерятся как HTML — вроде нет, они plain text.

**Миграции БД:** нет.
**Верификация:** создать статью с контентом `<img src=x onerror="alert(1)">`, сохранить, открыть — alert не должен сработать, картинки просто нет или показана broken.

---

## P0-2. VK OAuth: утечка токенов в логи

**Где:** `app/api/auth/callback/vk/route.ts:83` — `console.error("VK token exchange failed:", tokens)`. В `tokens` содержатся `access_token`, `id_token`, `refresh_token`.

**Почему опасно:** логи на Beget читаются по SSH. Утекший `access_token` позволяет дергать VK API от имени юзера; `id_token` — подделать нашу сессию.

**Что делаем:**
1. Заменить на структурный лог без секретов:
   ```ts
   console.error("VK token exchange failed:", {
     hasAccessToken: !!tokens.access_token,
     error: (tokens as any).error,
     errorDescription: (tokens as any).error_description,
   })
   ```
2. Пробежать `grep -n "console\\.\\(log\\|error\\|warn\\).*tokens" app/ lib/` — других утечек нет, но перепроверить.

**Верификация:** спровоцировать ошибку обмена (подложить неверный `client_secret`), убедиться что в логах только `hasAccessToken: false` + error code.

---

## P0-3. Customer login case-sensitive

**Где:** `lib/auth.ts:65` — `where: { email: credentials.email as string }`. Админ-провайдер на строке 27 нормализует (`.toLowerCase().trim()`), клиентский — нет.

**Почему опасно:** юзер регистрируется как `John@Example.com` (верхний регистр из автокомплита), потом входит как `john@example.com` → «неверный email или пароль». Поддержка получает жалобы, реальные клиенты уходят.

**Что делаем:**
1. Нормализовать email в customer `authorize`: `const email = String(credentials.email).toLowerCase().trim()` и дальше использовать `email`.
2. Миграция нормализации существующих записей — НЕ нужна: email уникален регистрозависимо в БД. Если в таблице уже есть дубликаты (`John@x.com` и `john@x.com` одновременно) — их почти наверняка нет, но стоит проверить:
   ```sql
   SELECT LOWER(email), COUNT(*) FROM "User" GROUP BY 1 HAVING COUNT(*) > 1;
   ```
3. Если дубликаты есть — решить руками.
4. При регистрации (`lib/actions/auth.ts`) тоже нормализовать — проверить.

**Верификация:** зарегистрироваться как `UPPER@x.com`, войти как `upper@x.com` — должно пустить.

---

## P0-4. CDEK webhook уязвим к replay

**Где:** `app/api/delivery/cdek-webhook/route.ts:12-13` — проверка `secret !== webhookSecret` из query-параметра. Нет HMAC, нет timestamp, нет idempotency.

**Почему опасно:** одно перехваченное значение `?secret=...` (через access_log прокси/cdn/заказ попал в чей-то мессенджер) позволяет attacker'у слать повторы сколько угодно. Каждый «доставит» событие DELIVERED на чужой заказ — отмена бонусов, письма клиенту, неконсистентный статус.

**Что делаем:**
1. В админ-панели СДЭК настраивать свой HMAC secret и включить подписи (если СДЭК умеет — проверить, возможно придётся остаться на query-secret).
2. Добавить idempotency: модель `ProcessedInboundEvent` (source="cdek", eventId=uuid события) — у millorbot уже есть. Проверять перед применением update.
3. Timestamp skew: СДЭК шлёт `date_time` события — отклонять старше 15 мин.
4. Если CDEK не поддерживает HMAC из коробки — использовать формат URL'а `/cdek-webhook/{secret}/` + ротация secret'а раз в N дней через админку.

**Миграции БД:** нет (ProcessedInboundEvent уже есть, расширяем использование).
**Верификация:** отправить один и тот же webhook 2 раза — второй вернёт 200 но не перепишет статус; отправить webhook с `date_time` 20 мин назад — отклонить с 400.

---

## P0-5. YooKassa webhook IP-whitelist только в production

**Где:** `app/api/payments/webhook/route.ts:35` — `if (process.env.NODE_ENV === "production") { /* IP check */ }`.

**Почему опасно:** любой staging/preview-деплой принимает подделанные webhook'и → создаются fake платежи, летят письма клиентам/админу, EmailDispatch засоряется. Если staging публичен (даже через basic-auth — часто забывают) — доступен сканерам.

**Что делаем:**
1. Снять `NODE_ENV === "production"` guard, IP-whitelist всегда активен.
2. Дополнительно — HMAC-подпись ЮKassa (у них есть [notifications webhook signing](https://yookassa.ru/developers/using-api/webhooks)) — валидировать `Webhook-Signature` если включена.
3. IP-whitelist оставляем как second layer (IP из [их docs](https://yookassa.ru/developers/using-api/webhooks#ip)).

**Верификация:** с left IP отправить валидно-подписанный webhook — 403. С правильного IP без HMAC — 403.

---

## P0-6. VK OAuth: silent account linking без согласия

**Где:** `app/api/auth/callback/vk/route.ts:160-162` — если VK-email совпадает с existing user, прозрачно связывает аккаунты.

**Почему опасно:** сценарий «перехват аккаунта через подделанный email на VK». Юзер A регистрируется email+пароль `victim@x.com`. Attacker регистрирует VK с email-адресом `victim@x.com` (VK проверяет email по SMS — но не на всех этапах; кроме того, старые VK-аккаунты имели небезопасную верификацию). Вход через VK → auto-merge → attacker видит заказы и бонусы жертвы.

**Что делаем:**
1. Если `existingAccount` по `providerAccountId` отсутствует, но нашёлся `User` по email → НЕ линковать автоматом.
2. Редиректить на `/auth/link-account?provider=vk&hint=email`, где залогиненный клиент credentials-провайдером может подтвердить linking с VK; иначе — отказать со стр. «Этот email уже занят другим аккаунтом. Войдите паролем и привяжите VK в настройках».
3. Добавить endpoint `POST /api/account/link-provider` (залогиненный юзер инициирует новый OAuth-flow, и на callback линкуем к `session.user.id`).

**Миграции БД:** нет (Account модель уже есть).
**Верификация:** зарегаться как credentials `a@x.com` → создать VK-акк с тем же email → войти VK → увидеть «Аккаунт занят» вместо merge.

---

## P0-7. Нет rate-limit на credentials login

**Где:** `lib/auth.ts:25-60` и `app/api/auth/*` — NextAuth обрабатывает login без throttling.

**Почему опасно:** 100+ попыток пароля/сек через `POST /api/auth/callback/admin-credentials`. Для админ-аккаунта с 8-символьным паролем, без 2FA — brute-force реальна.

**Что делаем:**
1. Добавить rate-limit по паре `(email, IP)`: 5 попыток за 5 минут → блок на 15 мин.
2. Реализация: `@upstash/ratelimit` с Redis (если есть) или in-memory `Map<key, { attempts, blockedUntil }>` с cleanup — для single-instance Docker ок.
3. Применить в authorize-callback обоих credentials-провайдеров и в VK-callback (по IP).
4. Возвращать `Retry-After` header + fake-delay 500-1000ms на каждую неудачу (slowdown).

**Миграции БД:** нет.
**Верификация:** 6-я попытка за 5 минут с одного IP+email → `error: "Too many attempts"`.

---

## P0-8. OrderItem.orderId без индекса

**Где:** `prisma/schema.prisma:326-338` — у OrderItem **нет** `@@index([orderId])`. FK есть, но Postgres не создаёт индекс автоматически.

**Почему опасно:** каждый `order.items` из страницы заказа, админки, email-дисплея делает seq-scan по всей таблице OrderItem. На 10k+ заказов это уже заметно; на 100k — latency 200-500ms. В batch-операциях (рассылка, отчёты) — каскад.

**Что делаем:**
1. Добавить в schema:
   ```
   @@index([orderId])
   ```
2. Миграция: `CREATE INDEX CONCURRENTLY "OrderItem_orderId_idx" ON "OrderItem"("orderId");` — CONCURRENTLY не блокирует таблицу.
3. `npx prisma migrate dev --name add_orderitem_orderid_index` (но в SQL руками подставить CONCURRENTLY, Prisma генерирует обычный CREATE INDEX).

**Миграции БД:** аддитивная, safe on prod.
**Верификация:** `EXPLAIN SELECT * FROM "OrderItem" WHERE "orderId" = '...'` → `Index Scan` вместо `Seq Scan`.

---

# Этап 2 — P1 (функциональные баги)

## P1-1. «Бесплатная доставка от 3000₽» — ложь в UI

**Где:** `components/checkout/DeliveryOptions.tsx:27`, `components/product/ProductClientSection.tsx:57`, `app/terms/page.tsx:112`, Hero/Footer копии. Реальные правила в `prisma/seed-delivery-rules.ts:7-14` имеют ступеньки 3000/4000/5000/7000/10000/15000/25000/50000 по службам и весам.

**Что делаем (2 варианта):**
- **A (проще).** Упростить реальные правила в БД до единого порога 3000₽ для всех служб, соответствующий UI-обещанию. Риск: потеря маржи на мелких отправлениях Почтой.
- **B (честнее).** Динамически читать правила из `deliverySetting` / `deliveryRule`, показывать в UI персонализированный минимум: «Бесплатно от 3000₽ (СДЭК), от 5000₽ (Почта)». Endpoint `/api/delivery/settings` уже есть, дополнить полями порогов.

**Рекомендую B** — честно и уже под рукой данные. Оценка: 3-4 часа.

**Миграции БД:** нет.
**Верификация:** положить товар на 3500₽, выбрать СДЭК → «Бесплатно»; выбрать Почта → «+X₽ доставка» с подсказкой «бесплатно от 5000₽».

---

## P1-2. Stock race condition до createOrder

**Где:** `lib/actions/orders.ts` createOrder — проверка stock происходит в начале, но между проверкой и записью может быть `adjustStock` параллельного заказа.

**Что делаем:**
1. Реальная проверка уже есть в `adjustStock` через `SELECT ... FOR UPDATE` (`lib/dal/stock.ts:58-60`) — это хорошо, double-debit невозможен.
2. Но UX страдает: юзер оформляет, получает `"Товар кончился"` без понимания какой именно.
3. Добавить: при `adjustStock` неудаче — возвращать `{ failedItems: [{productId, name, available}] }`, на фронте показывать модалку «Эти товары больше недоступны» с кнопкой «Убрать из корзины и продолжить».
4. Обновлять Zustand cart store соответственно.

**Миграции БД:** нет.
**Верификация:** параллельно оформить 2 заказа на последнюю единицу → один успех, второй — нормальная модалка с предложением убрать.

---

## P1-3. DPD «Скоро» без обратной связи

**Где:** `components/checkout/DeliveryOptions.tsx:30-36`.

**Что делаем:**
1. Либо скрыть карточку DPD полностью до реализации.
2. Либо оставить disabled с tooltip «Подключим к концу 2026 — следите за новостями» + click на карточке ничего не делает вместо тихой немоты.

Рекомендую **скрыть** — чистый UI.

---

## P1-4. Rate-limit verification code attempts globally

**Где:** `lib/actions/auth.ts:40-89` — 3 кода/час + 5 попыток/код, но юзер может запросить новый код и получить ещё 5 попыток.

**Что делаем:**
1. Завести таблицу `VerificationAttempt(email, createdAt)` или использовать in-memory counter с key=email.
2. При каждой неудачной попытке инкрементировать; если >10 за час — блокировать весь flow для этого email на 1 час.
3. Успешная валидация — сбросить счётчик.

**Миграции БД:** опционально (in-memory ок для single-instance).
**Верификация:** 11 неверных попыток ввода кода за час (через разные коды) → `"Слишком много попыток, попробуйте через час"`.

---

## P1-5. Session maxAge сократить до 7 дней

**Где:** `lib/auth.ts` session config (default 30 дней у NextAuth v5), `app/api/auth/callback/vk/route.ts:237` (явно 30 дней).

**Что делаем:**
1. В `lib/auth.ts` добавить:
   ```ts
   session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 }
   ```
2. В VK-callback выставить то же значение.
3. Для админов — ещё короче, 2 дня: внутри JWT callback добавить `if (token.userType === "admin") exp = iat + 2*86400`.

**Верификация:** открыть devtools → cookies → `next-auth.session-token` → expires через 7 дней.

---

## P1-6. Recalc delivery при изменении корзины на checkout

**Где:** `components/checkout/CheckoutForm.tsx` — `calculateDeliveryRates` вызывается один раз при выборе города.

**Что делаем:**
1. Добавить `useEffect` на зависимости `[items, cityCode]` → debounce 500ms → recalculate rates.
2. Показать loading state в `DeliveryOptions` во время пересчёта.
3. Сбросить `selectedRate` если он больше не актуален (например, новый вес выбросил тариф из списка).

**Верификация:** выбрать город, тариф, добавить ещё товар в корзину (через другой таб или cart drawer) → rates обновятся.

---

## P1-7. Cancel payment UX — вернуть в корзину

**Где:** `app/thank-you/ThankYouContent.tsx:40-74` ветка `paymentStatus === "canceled"`.

**Что делаем:**
1. Текст: «Оплата отменена. Товары остались в корзине — можно оформить снова» (или «вернули на склад» если мы делаем refund stock при cancel — проверить `rollbackOrder` в webhook).
2. Кнопка «Вернуться в корзину» → `/cart`.
3. Если `rollbackOrder` уже вызывался и товары в БД уменьшены — это отдельный баг, тогда нужно и cart-store восстановить (сложнее).

**Проверить:** `app/api/payments/webhook/route.ts` при `canceled` откатывает stock, но cart-store на клиенте не знает об этом. Решение: fetch-endpoint `/api/cart/recover?order=X` возвращает items заказа, клиент мержит в свой cart.

**Верификация:** оплатить заказ → отменить на странице ЮKassa → возврат на `/thank-you?paymentStatus=canceled` → увидеть cart восстановленным, товары в наличии.

---

## P1-8. Saved addresses на checkout

**Где:** `components/checkout/CheckoutForm.tsx:72-75` — адреса подгружаются, но в UI не показаны.

**Что делаем:**
1. Под полем «Адрес» для авторизованного юзера рендерить `<select>` с saved addresses.
2. Выбор — заполняет город, улицу, индекс.
3. Кнопка «Добавить новый адрес» — открывает inline-форму + checkbox «Сохранить в профиль».
4. DAL: `getUserAddresses(userId)`, `createUserAddress(userId, data)` в `lib/dal/addresses.ts`.

**Миграции БД:** нет (UserAddress модель уже есть).

---

## P1-9. Rate-limit на delivery API

**Где:** `/api/delivery/rates`, `/pickup-points`, `/cities`, `/address-suggest`.

**Что делаем:**
1. Middleware или обёртка `withRateLimit(handler, { limit: 30, window: "1m" })` по IP.
2. Для тяжёлых (calculateRates) — ещё request deduplication (in-memory 5-sec cache по `hash(body)`).

**Верификация:** 31 запрос `/api/delivery/rates` за 60 сек → 429.

---

## P1-10. notifyPromotions / notifyNewProducts — ОТЛОЖЕНО

**Решение:** делаем в отдельном marketing-спринте одновременно с запуском рассылок. Сейчас оставляем как есть — галочки не подключены, но и не удаляем (чтобы не потерять существующие consent-записи пользователей).

Вернуться к пункту после закрытия Спринтов 1-4.

---

## P1-11. Stock-alerts в /dev/null

**Где:** `lib/integrations/stock-alerts.ts:49,71` вызывает `enqueueOutbox`, но worker не подписан на этот topic.

**Что делаем:**
1. Либо добавить handler в `scripts/outbox-worker.mjs` — отправка email админу при `stock < threshold`.
2. Либо убрать enqueue до реализации.

Рекомендую: **добавить handler** — админам реально полезно. Email: «Товар X — осталось Y шт (порог Z)».

---

## P1-12. Image upload magic-bytes validation

**Где:** `lib/actions/images.ts:16-44` — валидация по `file.type` из браузера (можно подделать).

**Что делаем:**
1. Читать первые 12 байт буфера, сравнивать с signature table (JPEG `FF D8 FF`, PNG `89 50 4E 47`, WebP `52 49 46 46 ... 57 45 42 50`).
2. Отклонять если не совпадает.
3. Использовать готовую либу `file-type` (4kb).

**Верификация:** загрузить `.exe` переименованный в `.jpg` — отклонить.

---

## P1-13. Order state machine: запретить delivered→cancelled и т.д.

**Где:** `lib/dal/orders.ts` ALLOWED_TRANSITIONS или где хранится логика transitions.

**Что делаем:**
1. Явная таблица переходов:
   - `pending → paid | confirmed | cancelled`
   - `paid → confirmed | cancelled`
   - `confirmed → shipped | cancelled`
   - `shipped → delivered | returned`
   - `delivered → returned` (опционально, если делаем возвраты)
   - `cancelled / delivered / returned → конечные, read-only`
2. В `updateOrderStatus` проверять `if (!ALLOWED_TRANSITIONS[order.status].includes(newStatus)) throw`.
3. UI админки — скрывать невозможные transitions из select'а.

---

## P1-14. Bonuses на отменённом после доставки заказе

**Где:** `lib/actions/orders.ts` cancelOrder — возвращает `bonusUsed`, но не обнуляет `bonusEarned`.

**Что делаем:**
1. В `cancelOrder` (или updateOrderStatus → cancelled) — если у заказа `bonusEarned > 0` и статус был `delivered`, вычитать из `user.bonusBalance`.
2. Записать `BonusTransaction(type="admin_adjustment", amount=-X, description="Возврат за отменённый заказ ...")`.
3. Если списание невозможно (уже потратил) — оставить баланс в минусе, чтобы следующие бонусы пошли на компенсацию. Или блокировать cancel. Пункт для обсуждения.

**Миграции БД:** нет.

---

# Этап 3 — P2 (UX / качество)

## P2-1. a11y: aria-label на icon-only кнопках

`CartDrawer.tsx:50`, `ProductGallery.tsx` thumbnail buttons, `FilterBar.tsx` close buttons. Пройтись grep'ом `<button` без текста-children.

## P2-2. Password complexity

`components/auth/RegisterForm.tsx:30` — минимум 8 символов, regex `/[a-zA-Z].*\d|\d.*[a-zA-Z]/` (хоть одна буква и цифра). UI-hint при вводе.

## P2-3. Loading states

Промокод-спиннер, related skeleton, FavoriteButton optimistic + spin, CheckoutForm submit button с `Loader` icon.

## P2-4. Hero «2-3 дня доставка»

Честнее: «от 2 дней» или «2-14 дней» (для Почты). `components/sections/Hero.tsx:65-67`.

## P2-5. Avatar colors by hash

`components/product/ReviewsList.tsx:34` — `avatarColors[hashCode(review.name) % avatarColors.length]`.

## P2-6. Якоря #products/#about/#testimonials

Проверить, что `id="products"` и т.д. действительно стоят на главной. Grep `id="products"` / `id="about"` / `id="testimonials"`.

## P2-7. Outbox backoff

`scripts/outbox-worker.mjs:54-57` — заменить `5^attempt * 5` на `2^attempt * 60`, cap 3600s.

## P2-8. Pochta errors → integrationLog

`lib/delivery/pochta.ts:61,79` — вместо `console.error` вызывать `logIntegration({ source: "pochta", ... })`.

## P2-9. Cascade → Restrict для Product

`prisma/schema.prisma` — у Product→Images/Variants/Reviews сменить `onDelete: Cascade` на `Restrict` + в админке делать soft-delete (`isActive=false`).

## P2-10. Telegram login replay nonce

`lib/telegram-auth.ts:19-21` — `ProcessedInboundEvent(source="telegram-login", eventId=hash)` защитит от replay тех же данных с другого устройства.

## P2-11. Checkout button sizing на 375px

`components/checkout/CheckoutForm.tsx:322-331` — `flex-wrap` + `text-sm` на узких экранах.

## P2-12. DaData fallback

`lib/delivery/dadata.ts` — try/catch → `return []` вместо throw.

## P2-13. Sitemap streaming

`lib/dal/products.ts:327-330` — перейти на курсорную пагинацию в `getProductSlugs()` или ограничить 10k.

---

# Этап 4 — Недоделки (доделать или убрать)

| # | Фича | Решение |
|---|---|---|
| N-1 | DPD интеграция | Убрать UI до реализации (см. P1-3) |
| N-2 | Admin approval email | Доделать — при `adminUser.create({ status: "pending" })` триггерить `sendAdminPendingApprovalEmail(admins)` через EmailDispatch |
| N-3 | CSV import/export | Отдельный спринт, оценка 2-3 дня. Пока убрать upcoming-текст из UI |
| N-4 | BulkStockIntake action | Доделать server action, 4-6 часов |
| N-5 | Collections удаление | Добавить DELETE handler в `/admin/collections`, soft-delete через `isActive` |
| N-6 | Promotions edit UI | Отдельный спринт, скрыть раздел до готовности |
| N-7 | Admin activity log viewer | Добавить фильтры (action, user, date range) + пагинацию |
| N-8 | Yandex.Metrika funnels | Добавить goals: `cart_add`, `checkout_start`, `payment_initiated`, `purchase` — уже есть только последний |
| N-9 | DeliveryCalculator tester save results | Отдельная таблица `DeliveryCalculatorTest` + history view — если реально нужно админам |

---

# Порядок выполнения и коммиты

## Спринт 1 — Этап 1 (P0)
**Срок:** 1 день работы. Каждое — отдельный коммит.

1. `fix(security): DOMPurify санитизация article.content в блоге` (P0-1)
2. `fix(security): убрать утечку VK-токенов в console.error` (P0-2)
3. `fix(auth): нормализовать email в customer credentials` (P0-3)
4. `fix(webhooks): idempotency + timestamp skew для CDEK webhook` (P0-4)
5. `fix(payments): YooKassa IP-check активен во всех env` (P0-5)
6. `fix(auth): VK OAuth без silent account linking` (P0-6)
7. `feat(security): rate-limit на credentials login + VK callback` (P0-7)
8. `perf(db): индекс OrderItem.orderId` (P0-8) — миграция CONCURRENTLY

## Спринт 2 — Этап 2 (P1)
**Срок:** 2-3 дня. Группировать по темам:
- Delivery UX: P1-1, P1-6, P1-9 (один PR)
- Stock/Orders: P1-2, P1-13, P1-14 (второй PR)
- Auth/Session: P1-4, P1-5 (третий)
- Checkout UX: P1-3, P1-7, P1-8 (четвёртый)
- Integrations: P1-10, P1-11, P1-12 (пятый)

## Спринт 3 — Этап 3 (P2)
**Срок:** 1-2 дня, одним-двумя коммитами по темам (a11y bundle, perf bundle, copy bundle).

## Спринт 4 — Этап 4 (недоделки)
**Срок:** планируется отдельно, зависит от бизнес-приоритетов. Минимум — зачистить UI: убрать DPD, CSV upcoming-тексты, Promotions edit до готовности.

---

# Критерии завершения

- [ ] Все P0 закрыты и задеплоены на прод.
- [ ] Для каждого P0 есть smoke-test (ручной или скрипт) — записан в commit body.
- [ ] `npx tsc --noEmit` и `npx next lint` чистые.
- [ ] Миграции применены через `docker compose run --rm app npx prisma migrate deploy`, контейнеры рестартованы.
- [ ] Smoke-check: `/`, `/catalog`, `/checkout`, `/account/*`, `/admin/*`, `/track/*` — 200 или корректный redirect.
- [ ] Обновлена `MEMORY.md` с ключевыми решениями спринта.

---

# Решения по открытым вопросам (2026-04-23)

1. **Rate-limit storage** → **in-memory Map**. Single-instance Docker setup, при рестарте счётчики обнуляются (приемлемо). Redis вернём когда появится horizontal scale.
2. **CDEK webhook** → **idempotency (ProcessedInboundEvent по uuid) + timestamp skew 15 мин**. Без HMAC, query-secret остаётся.
3. **DPD** → **скрыть из UI до реализации**. Удаляем карточку из checkout.
4. **notifyPromotions/notifyNewProducts** → **отложить**. Этим займёмся после закрытия текущих спринтов, когда будем реализовывать marketing-рассылки. В текущем плане пункт P1-10 переносим в «будущие спринты».
5. **Cascade → Restrict для Product** → **soft-delete через isActive=false**. В админке кнопка «Удалить» заменяется на «Архивировать», DAL фильтрует по `isActive=true` для публичного каталога. Исторические ProductImage/Variant/Review сохраняются для старых заказов и отзывов.
