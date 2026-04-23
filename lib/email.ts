import nodemailer from "nodemailer"

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.beget.com",
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
  // Пул TCP-соединений: переиспользуем сокеты для последовательных писем,
  // не создавая новый handshake на каждый sendMail. rateLimit ограничивает
  // скорость отправки, чтобы Beget не закрыл соединение с "too many requests".
  pool: true,
  maxConnections: 3,
  maxMessages: 50,
  rateDelta: 1000,
  rateLimit: 10,
  // Явные таймауты вместо дефолтных ~3 мин: не даём SMTP подвесить event-loop
  // при зависании Beget. connectionTimeout — на открытие TCP, socketTimeout —
  // на полный обмен (greet+auth+send).
  connectionTimeout: 5000,
  socketTimeout: 10000,
  greetingTimeout: 5000,
})

const fromEmail = process.env.SMTP_USER || "noreply@millor-coffee.ru"
const siteUrl = (process.env.NEXTAUTH_URL || "https://millor-coffee.ru").replace(/\/$/, "")

// Список ящиков для админ-уведомлений: запятые в ADMIN_NOTIFICATION_EMAILS → массив.
// fallback на исторический newrefining@yandex.ru чтобы ничего не сломать, если env не выставлен.
const ADMIN_NOTIFICATION_EMAILS = (process.env.ADMIN_NOTIFICATION_EMAILS || "newrefining@yandex.ru")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)

export function getAdminNotificationEmails(): string[] {
  return ADMIN_NOTIFICATION_EMAILS
}

/**
 * Извлекает messageId + response из результата nodemailer.sendMail.
 * Нормализует shape для EmailDispatch.
 */
export interface SendResult {
  messageId?: string
  response?: string
}
function extractResult(info: { messageId?: string; response?: string }): SendResult {
  return { messageId: info.messageId, response: info.response }
}

/**
 * Универсальная точка отправки предварительно отрендеренного письма.
 * Вызывается из dispatchEmail (как send-callback). Принимает готовые subject+html.
 * Возвращает {messageId, response} для записи в EmailDispatch.
 */
export async function sendRenderedEmail(email: {
  to: string
  subject: string
  html: string
  fromEmail?: string
}): Promise<SendResult> {
  const info = await transporter.sendMail({
    from: `"Millor Coffee" <${email.fromEmail || fromEmail}>`,
    to: email.to,
    subject: email.subject,
    html: email.html,
  })
  return extractResult(info)
}

// ── Helpers ──

/**
 * Экранирование HTML-чувствительных символов в user-вводимых данных (имя, заметки,
 * адрес доставки, промокод и т.д.). Защищает шаблоны писем от XSS: агрессивный
 * customerName вида `<img src=x onerror=...>` стал бы активным HTML в письме.
 */
function escapeHtml(v: unknown): string {
  if (v === null || v === undefined) return ""
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}
// Короткий alias — чтобы шаблоны читались проще.
const e = escapeHtml

const deliveryMethodLabels: Record<string, string> = {
  cdek: "СДЭК",
  pochta: "Почта России",
  courier: "Курьер",
}

const deliveryTypeLabels: Record<string, string> = {
  door: "Доставка до двери",
  pvz: "Пункт выдачи",
}

const statusLabels: Record<string, string> = {
  pending: "Ожидает обработки",
  paid: "Оплачен",
  confirmed: "Подтверждён",
  shipped: "Отправлен",
  delivered: "Доставлен",
  payment_failed: "Ошибка оплаты",
  cancelled: "Отменён",
}

interface OrderItem {
  name: string
  weight: string
  price: number
  quantity: number
}

export interface OrderEmailData {
  orderNumber: string
  customerName: string
  customerEmail?: string
  customerPhone: string
  items: OrderItem[]
  subtotal: number
  discount: number
  deliveryPrice: number
  total: number
  bonusUsed?: number
  promoCode?: string
  deliveryMethod?: string
  deliveryType?: string
  deliveryAddress?: string
  pickupPointName?: string
  destinationCity?: string
  estimatedDelivery?: string
  paymentMethod?: string
  notes?: string
  /** Permanent-токен для /track-ссылки. Обязателен для новых заказов;
   * legacy-заказы (до миграции) могут не иметь токена — в этом случае
   * шаблон упадёт на fallback /account/orders. */
  trackingToken?: string
}

/**
 * Строит ссылку на страницу отслеживания заказа.
 * Работает одинаково для гостей и зарегистрированных: страница /track/[orderNumber]
 * пускает авторизованного владельца без токена, а гостя — по токену из query.
 */
function buildTrackingLink(orderNumber: string, trackingToken?: string): string {
  if (trackingToken) {
    return `${siteUrl}/track/${encodeURIComponent(orderNumber)}?token=${encodeURIComponent(trackingToken)}`
  }
  // Fallback для legacy-заказов без trackingToken
  return `${siteUrl}/account/orders`
}

function renderTrackingFooter(orderNumber: string, trackingToken?: string): string {
  const url = buildTrackingLink(orderNumber, trackingToken)
  return `<p style="color: #888; font-size: 14px; margin-top: 24px;">
    Следить за заказом можно на <a href="${url}" style="color: #7c4a1e;">странице заказа</a>.
  </p>`
}

function formatPrice(n: number): string {
  return n.toLocaleString("ru-RU")
}

function buildItemsTableHtml(items: OrderItem[]): string {
  const rows = items.map((item) => `
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #333; font-size: 14px;">
        ${e(item.name)} (${e(item.weight)})
      </td>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #555; font-size: 14px; text-align: center;">
        ${item.quantity} шт.
      </td>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #333; font-size: 14px; text-align: right; white-space: nowrap;">
        ${formatPrice(item.price * item.quantity)}₽
      </td>
    </tr>
  `).join("")

  return `
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <thead>
        <tr>
          <th style="padding: 8px 0; border-bottom: 2px solid #e5ddd5; text-align: left; color: #888; font-size: 12px; font-weight: 600; text-transform: uppercase;">Товар</th>
          <th style="padding: 8px 0; border-bottom: 2px solid #e5ddd5; text-align: center; color: #888; font-size: 12px; font-weight: 600; text-transform: uppercase;">Кол-во</th>
          <th style="padding: 8px 0; border-bottom: 2px solid #e5ddd5; text-align: right; color: #888; font-size: 12px; font-weight: 600; text-transform: uppercase;">Сумма</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `
}

function buildTotalsHtml(data: Pick<OrderEmailData, "subtotal" | "discount" | "deliveryPrice" | "total" | "bonusUsed" | "promoCode">): string {
  const lines: string[] = []

  lines.push(`<tr><td style="padding: 4px 0; color: #555; font-size: 14px;">Товары:</td><td style="padding: 4px 0; text-align: right; color: #333; font-size: 14px;">${formatPrice(data.subtotal)}₽</td></tr>`)

  if (data.discount > 0) {
    lines.push(`<tr><td style="padding: 4px 0; color: #555; font-size: 14px;">Скидка${data.promoCode ? ` (${e(data.promoCode)})` : ""}:</td><td style="padding: 4px 0; text-align: right; color: #d33; font-size: 14px;">−${formatPrice(data.discount)}₽</td></tr>`)
  }

  if (data.bonusUsed && data.bonusUsed > 0) {
    lines.push(`<tr><td style="padding: 4px 0; color: #555; font-size: 14px;">Бонусы:</td><td style="padding: 4px 0; text-align: right; color: #d33; font-size: 14px;">−${formatPrice(data.bonusUsed)}₽</td></tr>`)
  }

  lines.push(`<tr><td style="padding: 4px 0; color: #555; font-size: 14px;">Доставка:</td><td style="padding: 4px 0; text-align: right; color: #333; font-size: 14px;">${data.deliveryPrice > 0 ? formatPrice(data.deliveryPrice) + "₽" : "Бесплатно"}</td></tr>`)

  lines.push(`<tr><td style="padding: 8px 0 0; border-top: 2px solid #e5ddd5; color: #333; font-size: 18px; font-weight: bold;">Итого:</td><td style="padding: 8px 0 0; border-top: 2px solid #e5ddd5; text-align: right; color: #7c4a1e; font-size: 18px; font-weight: bold;">${formatPrice(data.total)}₽</td></tr>`)

  return `<table style="width: 100%; border-collapse: collapse; margin-top: 8px;">${lines.join("")}</table>`
}

function buildDeliveryHtml(data: Pick<OrderEmailData, "deliveryMethod" | "deliveryType" | "deliveryAddress" | "pickupPointName" | "destinationCity" | "estimatedDelivery">): string {
  const parts: string[] = []

  if (data.deliveryMethod) {
    parts.push(`<strong>Служба:</strong> ${deliveryMethodLabels[data.deliveryMethod] || data.deliveryMethod}`)
  }
  if (data.deliveryType) {
    parts.push(`<strong>Способ:</strong> ${deliveryTypeLabels[data.deliveryType] || data.deliveryType}`)
  }
  if (data.destinationCity) {
    parts.push(`<strong>Город:</strong> ${e(data.destinationCity)}`)
  }
  if (data.pickupPointName) {
    parts.push(`<strong>Пункт выдачи:</strong> ${e(data.pickupPointName)}`)
  }
  if (data.deliveryAddress) {
    parts.push(`<strong>Адрес:</strong> ${e(data.deliveryAddress)}`)
  }
  if (data.estimatedDelivery) {
    parts.push(`<strong>Срок:</strong> ${e(data.estimatedDelivery)}`)
  }

  if (parts.length === 0) return ""

  return `
    <div style="background: #f9f7f4; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #333;">Доставка</p>
      ${parts.map((p) => `<p style="margin: 4px 0; font-size: 14px; color: #555;">${p}</p>`).join("")}
    </div>
  `
}

function wrapEmail(content: string): string {
  return `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; color: #333;">
      ${content}
      <p style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #eee; color: #999; font-size: 12px;">
        Millor Coffee — свежеобжаренный кофе<br>
        <a href="${siteUrl}" style="color: #7c4a1e;">millor-coffee.ru</a>
      </p>
    </div>
  `
}

// ── Verification / Password Reset (unchanged) ──

export async function sendVerificationCode(email: string, code: string): Promise<SendResult> {
  const info = await transporter.sendMail({
    from: `"Millor Coffee" <${fromEmail}>`,
    to: email,
    subject: "Код подтверждения — Millor Coffee",
    html: wrapEmail(`
      <h2 style="color: #7c4a1e; margin-bottom: 16px;">Подтверждение email</h2>
      <p style="color: #555; font-size: 16px; line-height: 1.5;">
        Ваш код подтверждения:
      </p>
      <div style="background: #f5f0eb; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #7c4a1e;">${code}</span>
      </div>
      <p style="color: #888; font-size: 14px;">
        Код действителен 10 минут. Если вы не запрашивали код, проигнорируйте это письмо.
      </p>
    `),
  })
  return extractResult(info)
}

export async function sendPasswordResetCode(email: string, code: string): Promise<SendResult> {
  const info = await transporter.sendMail({
    from: `"Millor Coffee" <${fromEmail}>`,
    to: email,
    subject: "Сброс пароля — Millor Coffee",
    html: wrapEmail(`
      <h2 style="color: #7c4a1e; margin-bottom: 16px;">Сброс пароля</h2>
      <p style="color: #555; font-size: 16px; line-height: 1.5;">
        Вы запросили сброс пароля. Введите этот код на сайте:
      </p>
      <div style="background: #f5f0eb; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #7c4a1e;">${code}</span>
      </div>
      <p style="color: #888; font-size: 14px;">
        Код действителен 10 минут. Если вы не запрашивали сброс пароля, проигнорируйте это письмо.
      </p>
    `),
  })
  return extractResult(info)
}

// ── Order Status Email (for customer) ──

export function renderOrderStatusEmail({
  customerName,
  orderNumber,
  newStatus,
  trackingToken,
}: {
  customerName: string
  orderNumber: string
  newStatus: string
  trackingToken?: string
}): { subject: string; html: string } {
  const statusText = statusLabels[newStatus] || newStatus
  return {
    subject: `Заказ ${orderNumber} — ${statusText}`,
    html: wrapEmail(`
      <h2 style="color: #7c4a1e; margin-bottom: 16px;">Статус заказа обновлён</h2>
      <p style="color: #555; font-size: 16px; line-height: 1.5;">
        ${e(customerName)}, ваш заказ <strong>${e(orderNumber)}</strong> получил новый статус:
      </p>
      <div style="background: #f5f0eb; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
        <span style="font-size: 20px; font-weight: bold; color: #7c4a1e;">${e(statusText)}</span>
      </div>
      ${renderTrackingFooter(orderNumber, trackingToken)}
    `),
  }
}

export async function sendOrderStatusEmail(args: {
  to: string
  customerName: string
  orderNumber: string
  newStatus: string
  trackingToken?: string
}): Promise<SendResult> {
  const { subject, html } = renderOrderStatusEmail(args)
  return sendRenderedEmail({ to: args.to, subject, html })
}

// ── Customer: Order Confirmation ──

export function renderOrderConfirmationEmail(data: OrderEmailData): { subject: string; html: string } {
  const paymentNote =
    data.paymentMethod === "online"
      ? `<p style="color: #888; font-size: 14px; margin-top: 16px;">Мы пришлём отдельное письмо после подтверждения оплаты.</p>`
      : `<p style="color: #555; font-size: 14px; margin-top: 16px;">Оплата принимается при получении посылки.</p>`

  const html = wrapEmail(`
    <h2 style="color: #7c4a1e; margin-bottom: 16px;">Заказ оформлен</h2>
    <p style="color: #555; font-size: 16px; line-height: 1.5;">
      ${e(data.customerName)}, спасибо за заказ <strong>${e(data.orderNumber)}</strong>!
    </p>

    ${buildItemsTableHtml(data.items)}
    ${buildTotalsHtml(data)}
    ${buildDeliveryHtml(data)}
    ${paymentNote}

    ${renderTrackingFooter(data.orderNumber, data.trackingToken)}
  `)

  return {
    subject: `Заказ ${data.orderNumber} оформлен — Millor Coffee`,
    html,
  }
}

export async function sendOrderConfirmationEmail(data: OrderEmailData): Promise<SendResult> {
  if (!data.customerEmail) return {}
  const { subject, html } = renderOrderConfirmationEmail(data)
  return sendRenderedEmail({ to: data.customerEmail, subject, html })
}

// ── Customer: Payment Success ──

export function renderPaymentSuccessEmail(data: OrderEmailData): { subject: string; html: string } {
  const html = wrapEmail(`
    <h2 style="color: #2d6b4a; margin-bottom: 16px;">Оплата прошла успешно</h2>
    <p style="color: #555; font-size: 16px; line-height: 1.5;">
      ${e(data.customerName)}, оплата заказа <strong>${e(data.orderNumber)}</strong> подтверждена!
    </p>

    ${buildItemsTableHtml(data.items)}
    ${buildTotalsHtml(data)}
    ${buildDeliveryHtml(data)}

    <p style="color: #555; font-size: 14px; margin-top: 24px;">
      Мы начинаем готовить ваш заказ к отправке. Уведомим, когда передадим его в доставку.
    </p>
    ${renderTrackingFooter(data.orderNumber, data.trackingToken)}
  `)
  return {
    subject: `Оплата заказа ${data.orderNumber} подтверждена — Millor Coffee`,
    html,
  }
}

export async function sendPaymentSuccessEmail(data: OrderEmailData): Promise<SendResult> {
  if (!data.customerEmail) return {}
  const { subject, html } = renderPaymentSuccessEmail(data)
  return sendRenderedEmail({ to: data.customerEmail, subject, html })
}

// ── Admin: New Order Notification ──

export function renderAdminNewOrderEmail(data: OrderEmailData): { subject: string; html: string } {
  const paymentLabel = data.paymentMethod === "online" ? "Онлайн (YooKassa)" : "При получении"
  const html = wrapEmail(`
    <h2 style="color: #7c4a1e; margin-bottom: 16px;">Новый заказ ${e(data.orderNumber)}</h2>

    <div style="background: #f9f7f4; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #333;">Покупатель</p>
      <p style="margin: 4px 0; font-size: 14px; color: #555;"><strong>Имя:</strong> ${e(data.customerName)}</p>
      <p style="margin: 4px 0; font-size: 14px; color: #555;"><strong>Телефон:</strong> ${e(data.customerPhone)}</p>
      ${data.customerEmail ? `<p style="margin: 4px 0; font-size: 14px; color: #555;"><strong>Email:</strong> ${e(data.customerEmail)}</p>` : ""}
      ${data.notes ? `<p style="margin: 4px 0; font-size: 14px; color: #555;"><strong>Комментарий:</strong> ${e(data.notes)}</p>` : ""}
    </div>

    ${buildItemsTableHtml(data.items)}
    ${buildTotalsHtml(data)}
    ${buildDeliveryHtml(data)}

    <div style="background: #f9f7f4; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="margin: 4px 0; font-size: 14px; color: #555;"><strong>Оплата:</strong> ${paymentLabel}</p>
    </div>

    <p style="margin-top: 24px;">
      <a href="${siteUrl}/admin/orders" style="display: inline-block; background: #7c4a1e; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">Открыть в админке</a>
    </p>
  `)
  return {
    subject: `Новый заказ ${data.orderNumber} — ${data.customerName}, ${formatPrice(data.total)}₽`,
    html,
  }
}

export async function sendAdminNewOrderEmail(data: OrderEmailData, to: string): Promise<SendResult> {
  const { subject, html } = renderAdminNewOrderEmail(data)
  return sendRenderedEmail({ to, subject, html })
}

// ── Customer: Order Shipped (передан в доставку) ──

function trackingUrl(carrier: string | undefined, trackingNumber: string | undefined): string | null {
  if (!trackingNumber) return null
  const t = encodeURIComponent(trackingNumber)
  switch (carrier) {
    case "cdek":
      return `https://www.cdek.ru/ru/tracking?order_id=${t}`
    case "pochta":
      return `https://www.pochta.ru/tracking?barcode=${t}`
    default:
      return null
  }
}

export interface ShippedEmailData extends OrderEmailData {
  trackingNumber?: string
}

export function renderOrderShippedEmail(data: ShippedEmailData): { subject: string; html: string } {
  const track = data.trackingNumber
  const url = trackingUrl(data.deliveryMethod, track)
  const carrierLabel = data.deliveryMethod ? deliveryMethodLabels[data.deliveryMethod] || data.deliveryMethod : ""

  const trackBlock = track
    ? `
      <div style="background: #f5f0eb; border-radius: 12px; padding: 20px; margin: 24px 0; text-align: center;">
        <p style="margin: 0 0 6px; color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Трек-номер</p>
        <p style="margin: 0 0 12px; color: #7c4a1e; font-size: 22px; font-weight: bold; letter-spacing: 2px;">${e(track)}</p>
        ${url ? `<a href="${url}" style="display: inline-block; background: #7c4a1e; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">Отследить посылку</a>` : ""}
      </div>
    `
    : ""

  const html = wrapEmail(`
    <h2 style="color: #7c4a1e; margin-bottom: 16px;">Заказ передан в доставку</h2>
    <p style="color: #555; font-size: 16px; line-height: 1.5;">
      ${e(data.customerName)}, мы передали ваш заказ <strong>${e(data.orderNumber)}</strong>${carrierLabel ? ` в службу ${e(carrierLabel)}` : ""}.
    </p>
    ${trackBlock}
    ${buildDeliveryHtml(data)}
    ${renderTrackingFooter(data.orderNumber, data.trackingToken)}
  `)
  return {
    subject: `Заказ ${data.orderNumber} передан в доставку${track ? ` — трек ${track}` : ""}`,
    html,
  }
}

export async function sendOrderShippedEmail(data: ShippedEmailData): Promise<SendResult> {
  if (!data.customerEmail) return {}
  const { subject, html } = renderOrderShippedEmail(data)
  return sendRenderedEmail({ to: data.customerEmail, subject, html })
}

// ── Customer: Order Delivered ──

export function renderOrderDeliveredEmail(data: OrderEmailData): { subject: string; html: string } {
  const isPvz = data.deliveryType === "pvz"
  const pickupLine = isPvz && data.pickupPointName
    ? `Заберите его в пункте выдачи: <strong>${e(data.pickupPointName)}</strong>.`
    : "Посылка доставлена на указанный адрес."

  const html = wrapEmail(`
    <h2 style="color: #2d6b4a; margin-bottom: 16px;">Заказ доставлен</h2>
    <p style="color: #555; font-size: 16px; line-height: 1.5;">
      ${e(data.customerName)}, ваш заказ <strong>${e(data.orderNumber)}</strong> прибыл!
      ${isPvz ? pickupLine : ""}
    </p>
    ${buildDeliveryHtml(data)}
    <p style="color: #555; font-size: 14px; margin-top: 24px;">
      Спасибо, что выбрали Millor Coffee. Будем рады видеть вас снова!
    </p>
    ${renderTrackingFooter(data.orderNumber, data.trackingToken)}
  `)
  return {
    subject: `Заказ ${data.orderNumber} доставлен — Millor Coffee`,
    html,
  }
}

export async function sendOrderDeliveredEmail(data: OrderEmailData): Promise<SendResult> {
  if (!data.customerEmail) return {}
  const { subject, html } = renderOrderDeliveredEmail(data)
  return sendRenderedEmail({ to: data.customerEmail, subject, html })
}

// ── Admin: Payment Success Notification ──

export function renderAdminPaymentSuccessEmail(data: OrderEmailData): { subject: string; html: string } {
  const html = wrapEmail(`
    <h2 style="color: #2d6b4a; margin-bottom: 16px;">Оплата получена: ${e(data.orderNumber)}</h2>

    <div style="background: #e8f5e9; border-radius: 8px; padding: 16px; margin: 16px 0; text-align: center;">
      <span style="font-size: 24px; font-weight: bold; color: #2d6b4a;">${formatPrice(data.total)}₽</span>
    </div>

    <div style="background: #f9f7f4; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #333;">Покупатель</p>
      <p style="margin: 4px 0; font-size: 14px; color: #555;"><strong>Имя:</strong> ${e(data.customerName)}</p>
      <p style="margin: 4px 0; font-size: 14px; color: #555;"><strong>Телефон:</strong> ${e(data.customerPhone)}</p>
      ${data.customerEmail ? `<p style="margin: 4px 0; font-size: 14px; color: #555;"><strong>Email:</strong> ${e(data.customerEmail)}</p>` : ""}
    </div>

    ${buildItemsTableHtml(data.items)}
    ${buildTotalsHtml(data)}
    ${buildDeliveryHtml(data)}

    <p style="margin-top: 24px;">
      <a href="${siteUrl}/admin/orders" style="display: inline-block; background: #2d6b4a; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">Открыть в админке</a>
    </p>
  `)
  return {
    subject: `Оплата ${data.orderNumber} — ${formatPrice(data.total)}₽ от ${data.customerName}`,
    html,
  }
}

export async function sendAdminPaymentSuccessEmail(data: OrderEmailData, to: string): Promise<SendResult> {
  const { subject, html } = renderAdminPaymentSuccessEmail(data)
  return sendRenderedEmail({ to, subject, html })
}
