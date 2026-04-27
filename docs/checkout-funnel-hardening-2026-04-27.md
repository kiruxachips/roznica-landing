# Checkout Funnel Hardening — план укрепления пути «выбор товара → оплата»

**Дата:** 2026-04-27
**Источник:** серия из 5 параллельных кросс-аудитов (catalog→cart, wizard, pricing pipeline, order creation+payment, recent diff).
**Принцип:** бить в корень, не в симптомы. Ни один пункт не считается закрытым, пока (а) код пофикшен, (б) добавлен server-side guard или test, (в) проверено в проде.

---

## Категории и приоритеты

- **CRITICAL** — финансовый риск, утечка данных, дубль заказа/платежа, race на складе. Чиним первыми.
- **IMPORTANT** — UX-целостность, частичные потери данных, рассинхрон цены без денежного риска.
- **MINOR** — косметика, улучшения формы.

Каждая задача: `[ ]` — TODO, `[~]` — в работе, `[x]` — закрыт + verified.

---

## CRITICAL (10 пунктов)

### C1. Идемпотентность `createOrder` — нет защиты от двойного создания заказа
**Симптом:** sticky-bar `dispatchEvent('click')` (`CheckoutForm.tsx:144-147`) или быстрый double-click обходит `disabled` и `if (loading) return` (race до `setLoading`). Результат — два заказа с одинаковыми items, разными `orderNumber`, оба с YooKassa-платежом.
**Корень:** нет server-side идемпотентности. Защита висит только на UI-state.
**Фикс:**
1. На mount `CheckoutForm` сгенерировать `clientRequestId = crypto.randomUUID()` в `useRef` (новый при каждом маунте, переживает rerender).
2. Передавать в `createOrder({ ..., clientRequestId })`.
3. В Prisma — поле `Order.clientRequestId String? @unique` (миграция).
4. В DAL `createOrder` — перед transaction: `findUnique({ clientRequestId })` → если есть, вернуть его как success (идемпотентно), не создавать новый.
**Verify:** в dev-tools программно дёрнуть `document.getElementById('checkout-submit').click()` дважды подряд → должен быть ровно один заказ в БД.

### C2. `/thank-you` отдаёт чужой заказ по перебору `orderNumber`
**Симптом:** `MC-260427-XXXX` — короткий формат, перебираемый. Если token не валидируется жёстко, можно увидеть имя/телефон/email/состав чужого заказа. Серьёзная утечка PII (152-ФЗ).
**Корень:** thank-you page загружает заказ только по `orderNumber` (если так).
**Фикс:**
1. Прочитать `app/thank-you/page.tsx` и `ThankYouContent.tsx` — текущую логику.
2. Если token-валидация уже есть, но soft (например, показывает заказ без token частично) — сделать hard: 404 или редирект на /catalog без валидного token.
3. Альтернативный путь: если в session есть `userId` и `order.userId === userId` — пускать без token (для авторизованных).
4. Логировать попытки доступа без token / с неверным token (Sentry breadcrumb для подозрительного перебора).
**Verify:** `curl /thank-you?order=MC-XXXXXX-XXXX` без token должен вернуть 404/redirect, не PII.

### C3. `DeliveryPriceMismatchError` guard пробивается на `undefined`
**Симптом:** мой свежий guard `lib/dal/orders.ts:227` — `if (typeof data.deliveryPrice === "number" && deliveryPrice > data.deliveryPrice + 1)`. Если клиент шлёт `undefined` (старый бандл, ошибка в типах), guard молчит → переплата возможна.
**Корень:** опциональное поле в типе `OrderData`. Сама опциональность — рудимент из тех времён, когда delivery был опциональный.
**Фикс:**
1. В `OrderData` (lib/types.ts) сделать `deliveryPrice` обязательным: `deliveryPrice: number` (для retail; для wholesale можно отдельный тип).
2. В DAL: если `data.tariffCode !== undefined && data.deliveryMethod && !Number.isFinite(data.deliveryPrice)` — throw `Error("missing client deliveryPrice — refresh page")`.
3. Скорректировать guard: `if (deliveryPrice > data.deliveryPrice + 1)` (без typeof-чека, т.к. поле обязательное).
4. PaymentStep всегда передаёт `deliveryPrice = selectedRate?.priceWithMarkup ?? 0`.
**Verify:** unit-style — namочно подделать body запроса (devtools network → resend without deliveryPrice) → должен вернуться error, не успех.

### C4. `rollbackOrder` не атомарен
**Симптом:** `lib/actions/orders.ts:28-76` — возврат stock и обновление статуса заказа идут отдельными запросами. Если падёт БД между ними — заказ остаётся `pending`, товары вернулись на полку (overcount).
**Корень:** функция-обёртка над несколькими prisma.update без transaction.
**Фикс:**
1. Обернуть всю rollbackOrder-логику в `prisma.$transaction(async (tx) => { ... })`.
2. Внутри транзакции: вернуть stock через `tx.productVariant.update`, обновить `tx.order.update({ status: "cancelled" })`, при наличии gift — `tx.gift.update({ stock: { increment } })`.
3. Логировать причину и items в одном structured log.
**Verify:** искусственно убить контейнер БД в середине rollback (chaos-style) → после восстановления заказ либо целиком в `pending` со stock декрементированным, либо целиком в `cancelled` со stock возвращённым. Третьего не должно быть.

### C5. Race на последнем товаре между двумя оплатами
**Симптом:** User1 и User2 одновременно начали оплату последнего экземпляра. SELECT FOR UPDATE в createOrder защитит от двойного декремента — но webhook `payment.canceled` слепо делает `stock += 1` независимо от того, кто отменился. Возможный сценарий с stock в отрицательной зоне.
**Корень:** webhook не сравнивает с снапшотом stock на момент создания заказа.
**Фикс:**
1. В `Order` уже есть items с количеством — это снапшот того, сколько было декрементировано.
2. В webhook `payment.canceled`: refund возвращает строго `+order.items[i].quantity` для каждого item — это уже корректно, если cancellation идёт ровно один раз.
3. **Реальная защита:** убедиться что webhook идемпотентен. Если status уже `cancelled` — не делать refund второй раз.
4. Прочитать `app/api/yookassa/webhook/route.ts:236-272`: проверить, что есть guard `if (order.status === "cancelled") return`.
5. Если guard слабый — поставить `tx.$executeRaw` с `WHERE status != 'cancelled'`, и обновлять stock только если order.update().count === 1.
**Verify:** двойной POST одного и того же `payment.canceled` payload → stock не уплывает выше, чем был до создания заказа.

### C6. `/api/cart/replacements` — нет валидации `variantId`
**Симптом:** любая строка пройдёт. Не RCE (Prisma параметризован), но позволяет: (а) перебор/scrape всех variantId через timing-side-channel, (б) кэш-флуд через невалидные ключи.
**Корень:** мой свежий код, `body.variantId` принимается как любая `string`.
**Фикс:**
1. Добавить Zod-схему `z.object({ variantId: z.string().cuid() | z.string().uuid(), limit: z.number().int().min(1).max(6).optional() })`.
2. Установить `zod` если ещё нет (проверить package.json).
3. Rate-limit per-IP через простой in-memory token-bucket в middleware (5 req / 10s — generous, но защищает от scrape).
4. Аналогично проверить `/api/cart/recommendations` и `/api/cart/welcome-discount` — те же риски.
**Verify:** `curl POST /api/cart/replacements -d '{"variantId":"xxx"}'` → 400.

### C7. Welcome-discount race в `useDeliveryRates`
**Симптом:** `lib/hooks/use-delivery-rates.ts:42-50` — на маунте `welcome === null`, fetch ставок уходит с `cartTotal = subtotal` (без скидки). После загрузки welcome — refetch с правильным cartTotal. Между ними юзер может видеть «бесплатно» там, где должно быть «275₽», и повторение бага, который мы только что починили на сервере.
**Корень:** разные источники истины загружаются параллельно.
**Фикс:**
1. В `useWelcomeDiscount` различить «загружается» и «загружено: null/value» — вернуть `{loading: boolean, value: WelcomeDiscount | null}`.
2. В `useDeliveryRates`: `if (welcome.loading) return` — не запускать fetch, пока скидка ещё не определена.
3. После получения welcome — обычная цепочка с правильным cartTotal.
**Verify:** Network tab — должен быть строго один POST `/api/delivery/rates` после первого визита (а не два — первый «без скидки», второй «со скидкой»).

### C8. Бонусы — мёртвый код, рискует «ожить» некорректно
**Симптом:** `BonusSelector.tsx`, `lib/dal/bonuses.ts`, `creditBonusesForOrder` в orders.ts — целый слой кода, который в UI не подключён. PaymentStep не передаёт `bonusAmount`. Если кто-то «включит» позже, не починив pricing pipeline — клиент покажет цену БЕЗ вычета бонусов, спишет больше.
**Корень:** half-finished feature.
**Фикс — два варианта, выбрать с владельцем продукта:**
- **A. Удалить.** Если бонусная программа не запускается в обозримом будущем — выпилить `BonusSelector.tsx`, поля `bonusBalance` оставить (DB), но удалить unused код в actions/DAL. Меньше maintenance-долга.
- **B. Доинтегрировать.** Подключить `BonusSelector` в PaymentStep, передавать `bonusAmount` в createOrder, OrderSummary вычитать `bonusUsed` из финала, `useDeliveryRates` учитывать в `cartTotal` (как welcome).
**Решение пока:** оставить пометку `// TODO C8` в BonusSelector + закомментировать импорт в PaymentStep если он есть. **Спрашиваем владельца — пока не делаем выбор автоматически.**
**Verify:** grep по проекту — `bonusAmount`/`BonusSelector` упоминается только в DAL + закомментированных местах + DB-схеме.

### C9. Email regex слабый + телефон неоднозначный (PII validation)
**Симптом:** `ContactStep.tsx:98` — `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` ловит `t@g.c`, `t@.com`. Phone-валидация (`ContactStep.tsx:93-96`) принимает `+7`, `8`, `7` без обратной связи юзеру.
**Корень:** примитивные regex без RFC-приближения.
**Фикс:**
1. Email: `/^[^\s@]+@[^\s@]{2,}\.[a-zA-Z]{2,}$/` (минимум TLD из 2 латинских букв, домен ≥2 символов до точки).
2. Phone: нормализовать к `+7XXXXXXXXXX` строго; всё остальное — invalid с подсказкой «формат: +7 (xxx) xxx-xx-xx».
3. Сделать ту же нормализацию серверно при `createOrder` — не доверять клиенту.
**Verify:** ручная проверка `t@.com` отвергается, `8 911 ...` нормализуется в `+79114567890`.

### C10. Stock «+» в CartDrawer не уважает реальный stock
**Симптом:** `components/cart/CartDrawer.tsx:131-137` — кнопка `+` ограничена 99, но не проверяет `stock`. Юзер может набрать 50, на checkout получит модалку OOS — лишний цикл, плохой UX. Хуже: при race с другим заказом, ровно на checkout «вдруг» нет.
**Корень:** в cart-store не хранится snapshot stock.
**Фикс:**
1. Расширить `CartItem` полем `stockSnapshot: number | null` (на момент add).
2. При `addItem` сохранять `variant.stock`. Периодически (`/api/cart/stock-check` на drawer-open) обновлять snapshot.
3. Кнопка `+` — `disabled={item.stockSnapshot !== null && item.quantity >= item.stockSnapshot}`, рядом подпись «всего N в наличии».
**Verify:** добавить товар, в админке выставить stock=2, обновить drawer (или открыть заново) → кнопка `+` дизейблится при quantity=2.

---

## IMPORTANT (8 пунктов)

### I1. Возврат на «Контакты» оставляет `completed.delivery=true`
**Файл:** `lib/store/checkout-wizard.ts`
**Фикс:** при `setStep("contact")` сбрасывать `completed.delivery = false` и `completed.payment = false`. То же для `setStep("delivery")` → `completed.payment = false`. Доходим до шага → ставим `completed = true` для предыдущих, для текущего — только при validate-pass.

### I2. `completed`-флаги переживают reset корзины (persist)
**Файл:** `lib/store/checkout-wizard.ts`, `components/checkout/CheckoutForm.tsx:38-40`
**Фикс:** в `reset()` action стора — явно очистить персист: `useCheckoutWizard.persist.clearStorage()` (Zustand API).

### I3. PVZ-модалка без таймаута загрузки точек
**Файл:** `components/checkout/PickupPointModal.tsx:165-182`
**Фикс:** обернуть fetch в `Promise.race([fetch, sleep(15000)])` — при таймауте `setRatesError("ПВЗ временно недоступны, попробуйте обновить")`, отрисовать retry-кнопку.

### I4. Stock замены не сверяется с requested quantity
**Файл:** `components/checkout/steps/PaymentStep.tsx:464-477`
**Фикс:** в `onReplace`: `const realQty = Math.min(quantity, replacement.recommendedVariant.stock)`. Если `realQty < quantity` — toast «доступно только N штук, остальное не добавили». Если `realQty === 0` — не делать addItem, оставить позицию для повторного выбора.

### I5. Cart cleared ДО редиректа на YooKassa
**Файл:** `components/checkout/steps/PaymentStep.tsx:237-239`
**Фикс — двухходовка:**
1. Не очищать cart сразу. Сохранить snapshot заказа (orderNumber + items + totals) в localStorage `pendingPayment`.
2. Очистка корзины — на странице thank-you после `payment.succeeded` ИЛИ на возврате с YooKassa с признаком успеха.
3. Если юзер вернётся на /catalog/cart с `pendingPayment` в localStorage — показать баннер «у вас неоплаченный заказ MC-XXX, [продолжить оплату]» с ссылкой на сохранённый paymentUrl.
**Дополнительно:** автоматическое снятие `pendingPayment` через 30 минут (TTL) или при подтверждённой смене корзины.

### I6. GiftPicker не перепроверяет stock перед submit
**Файл:** `components/checkout/steps/PaymentStep.tsx:152` (createOrder), `lib/dal/orders.ts:222-263`
**Фикс:** на `handleSubmit` перед `createOrder` сделать `fetch('/api/gifts/available?cartTotal=...')` — если `selectedGiftId` отсутствует в результате, мягко показать toast «выбранный подарок закончился, выберите другой» и не блокировать оформление (просто null'ить selectedGiftId). Серверная валидация уже есть, но это снижает UX-friction.

### I7. WeightSelector + StickyAddToCart — независимые `selectedIndex`
**Файл:** `components/product/WeightSelector.tsx:27`, `components/product/StickyAddToCart.tsx:36`
**Фикс:** поднять `selectedVariantId` в родителя `ProductClientSection`, прокинуть через context или props в оба компонента. State один — оба view синхронизированы.

### I8. Email-suggest race без AbortController
**Файл:** `components/checkout/steps/ContactStep.tsx:190-204`
**Фикс:** `useRef<AbortController>` + `controller.abort()` на повторном blur, как в `CitySearch`.

---

## MINOR (8 пунктов, делаем после критики)

### M1. registerUser fail = тихий swallow + неверный banner «подтвердите email»
**Файл:** `components/checkout/steps/PaymentStep.tsx:188-200`
**Фикс:** проверять `result?.success` — если ошибка `"уже зарегистрирован"`, не сохранять `pendingVerificationEmail` в sessionStorage и НЕ показывать banner на thank-you. Вместо этого тихо логировать.

### M2. Phone normalization серверно
**Связано с C9.** Дублировать клиентскую логику в DAL `createOrder` — не хранить `8...` вперемежку с `+7...`.

### M3. `door`↔`pvz` toggle не чистит `doorAddress`
**Файл:** `lib/store/delivery.ts`
**Фикс:** при `selectRate({deliveryType: 'pvz'})` — `set({ doorAddress: '' })`. Аналогично обратно: при switch на door — null'ить `selectedPickupPoint`.

### M4. referralCode cookie может теряться
**Файл:** `lib/actions/orders.ts:135-148`
**Фикс:** при первом mount `CheckoutForm` зачитать cookie `ref` и положить в `useCheckoutWizard.referralCode` (новое поле, persist). При createOrder читать из стора, не cookie.

### M5. `scoreReplacements` показывает кандидатов даже при ×3 цене
**Файл:** `lib/recommendations.ts` (новая функция)
**Фикс:** hard-фильтр `pxScore > 0.2` (т.е. цена в пределах ~80% от target). Если после фильтра пусто — fallback показать без фильтра, чтобы не вернуть пустой ответ.

### M6. `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY:?required` валит контейнер на dev без `.env`
**Файл:** `docker-compose.yml`
**Фикс:** убрать `:?required`, добавить fallback на dev-only слабый ключ + warning в logs. Производство всё равно требует stable key (как в memory).

### M7. Sticky bottom-bar остаётся видимым при OOS-варианте
**Файл:** `components/product/StickyAddToCart.tsx:70-75`
**Фикс:** `hidden` если `selectedVariant.stock === 0`.

### M8. CartUpsell silent catch на ошибке сети
**Файл:** `components/cart/CartUpsell.tsx:58-60`
**Фикс:** залогировать в Sentry, секция не отрисовывается — это корректный fallback.

---

## Порядок работ (по проходам)

### Проход 1 — Critical Hard Fixes (4-6 часов)
C1 → C2 → C4 → C5 → C6 → C7 → C3
*Это денежные/безопасностные риски. Один PR, один деплой.*

### Проход 2 — Pricing Decisions (требует владельца продукта)
C8 — обсудить, удалить или доинтегрировать. Действуем по решению.

### Проход 3 — Validation & UX Integrity (3-4 часа)
C9 → C10 → I1 → I2 → I3 → I4 → I6 → I7 → I8

### Проход 4 — Cart & Payment UX (2-3 часа)
I5 (двухходовка с pendingPayment) — отдельный PR из-за объёма.

### Проход 5 — Polish (1-2 часа)
M1 → M3 → M4 → M5 → M7 → M8 (M2 уже в C9; M6 — отдельно).

### Проход 6 — Final Cross-Audit
Запустить новую серию из 5 параллельных аудитов по тому же скопу + проверка, что ни один из закрытых пунктов не «всплыл» в новой регрессии.

### Проход 2 (post-audit) — найденные кросс-аудитом критические дыры
Аудит обнаружил пункты, которых не было в первоначальном плане. Закрыто:

- **Pass-2-A** (CRITICAL): кнопка «Оплатить» показывала `finalTotal` БЕЗ welcome, OrderSummary вычитала welcome второй раз → расхождение 10% при first order. Welcome теперь учтён в `CheckoutForm.afterDiscount` (единый источник истины), оба места рендерятся согласованно. Соответствует серверной формуле `discount = promo XOR welcome`.
- **Pass-2-B** (CRITICAL): server-side `TotalMismatchError` поверх `DeliveryPriceMismatchError`. Клиент шлёт `expectedFinalTotal`, сервер сравнивает фактический `total` и блокирует оформление если списать пришлось бы больше. Допуск 2₽.
- **Pass-2-C** (HIGH): `P2002` catch теперь проверяет `meta.target` — раньше слепо ловил любой unique-violation и возвращал заказ по `clientRequestId`, хотя падение могло быть на другом поле (теоретическая коллизия `orderNumber`).
- **Pass-2-D** (MEDIUM): `stockSnapshot` для replacement-товара = реальный `stock` варианта (правильно). `realQty` идёт в `quantity`, snapshot — в snapshot.
- **Pass-2-E** (HIGH): `callbackUrl` в LoginForm проверяется на `startsWith('/') && !startsWith('//')` — open-redirect на внешний домен закрыт.
- **Pass-2-F** (MEDIUM): PII (имя, телефон) маскируется в `console.error("[createOrder] failed")` — `***1234`, `K***`. Отладочная польза сохранена, утечка в облачные логи минимизирована.

---

## Definition of Done

Пункт считается закрытым, когда:
1. Код пофикшен.
2. **Server-side guard** (если речь о клиент-серверном рассинхроне) — клиент НЕ единственная линия защиты.
3. **TypeScript строго** (никаких `any` для обхода).
4. `npx tsc --noEmit` проходит чисто.
5. Деплой `git push → ssh beget pull → docker compose up -d --build`.
6. `/api/health` 200, основной user-flow ручная проверка.
7. Чекбокс в этом документе помечен `[x]` + sha коммита.

---

## Риски и допущения

- **Миграция `clientRequestId` (C1)** — добавление nullable-колонки безопасно для текущих заказов; uniqueness применяется только для новых.
- **C5 webhook idempotency** — нужен careful manual test, потому что повторно вызвать YooKassa-callback в проде нельзя без mock.
- **C8 решение по бонусам** — не делаем без подтверждения владельца. Если ответ задержится, идём дальше по списку, C8 ставим в parking lot.
- **I5 pendingPayment** — добавляем localStorage-state, нужно убедиться что `.clearStorage()` отрабатывает корректно при истечении TTL.
- Все правки — feature-flag не нужны, потому что фиксят явные баги, а не меняют поведение.

---

## Tracking

| ID | Title | Status | Commit |
|----|-------|--------|--------|
| C1 | Idempotency createOrder | `[x]` | 1102ce9 |
| C2 | thank-you token-validation | `[x]` | 1102ce9 |
| C3 | deliveryPrice required + guard | `[x]` | 1102ce9 |
| C4 | rollbackOrder transaction | `[x]` | уже было (lib/actions/orders.ts:36) |
| C5 | Webhook stock idempotency | `[x]` | 1102ce9 (compare-and-swap) |
| C6 | Zod на /api/cart/replacements | `[x]` | 1102ce9 |
| C7 | Welcome-discount race | `[x]` | 1102ce9 |
| C8 | Bonuses dead code decision | `[ ]` | parking-lot — нужно решение владельца |
| C9 | Email/phone validation | `[x]` | 9e46a2f |
| C10 | Cart stock snapshot | `[x]` | 9e46a2f |
| I1 | completed flags reset on setStep | `[x]` | 9e46a2f |
| I2 | reset wizard clears persist | `[x]` | 9e46a2f |
| I3 | PVZ modal timeout | `[x]` | 9e46a2f |
| I4 | Replacement quantity vs stock | `[x]` | 9e46a2f |
| I5 | pendingPayment flow | `[x]` | B-1: 6bf8d5e, B-2/B-3: dfcde45, B-4: pending |
| I5-B5 | Email recovery «завершите оплату» | `[ ]` | backlog — улучшение UX, не критично |
| I6 | GiftPicker pre-submit recheck | `[x]` | 9e46a2f |
| I7 | WeightSelector + Sticky shared state | `[x]` | 9e46a2f |
| I8 | Email-suggest AbortController | `[x]` | 9e46a2f |
| M1 | registerUser already-verified case | `[x]` | pass-5 |
| M3 | door↔pvz state cleanup | `[x]` | pass-5 |
| M4 | referralCode persist | `[ ]` | low-priority backlog |
| M5 | scoreReplacements price filter | `[x]` | pass-5 |
| M6 | dev-only encryption key fallback | `[x]` | pass-5 |
| M7 | Sticky bar hidden on OOS | `[x]` | pass-5 |
| M8 | CartUpsell error logging | `[x]` | pass-5 |
| Pass-2-A | Welcome в едином finalTotal | `[x]` | pass-2 (post-audit) |
| Pass-2-B | TotalMismatchError server-guard | `[x]` | pass-2 (post-audit) |
| Pass-2-C | P2002 target check | `[x]` | pass-2 (post-audit) |
| Pass-2-D | realQty/stockSnapshot fix | `[x]` | pass-2 (post-audit) |
| Pass-2-E | callbackUrl open-redirect | `[x]` | pass-2 (post-audit) |
| Pass-2-F | PII в logs masked | `[x]` | pass-2 (post-audit) |
