import nodemailer from "nodemailer"

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.beget.com",
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
})

const fromEmail = process.env.SMTP_USER || "noreply@millor-coffee.ru"
const siteUrl = (process.env.NEXTAUTH_URL || "https://millor-coffee.ru").replace(/\/$/, "")

const ADMIN_NOTIFICATION_EMAIL = "newrefining@yandex.ru"

// ── Helpers ──

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
}

function formatPrice(n: number): string {
  return n.toLocaleString("ru-RU")
}

function buildItemsTableHtml(items: OrderItem[]): string {
  const rows = items.map((item) => `
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #333; font-size: 14px;">
        ${item.name} (${item.weight})
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
    lines.push(`<tr><td style="padding: 4px 0; color: #555; font-size: 14px;">Скидка${data.promoCode ? ` (${data.promoCode})` : ""}:</td><td style="padding: 4px 0; text-align: right; color: #d33; font-size: 14px;">−${formatPrice(data.discount)}₽</td></tr>`)
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
    parts.push(`<strong>Город:</strong> ${data.destinationCity}`)
  }
  if (data.pickupPointName) {
    parts.push(`<strong>Пункт выдачи:</strong> ${data.pickupPointName}`)
  }
  if (data.deliveryAddress) {
    parts.push(`<strong>Адрес:</strong> ${data.deliveryAddress}`)
  }
  if (data.estimatedDelivery) {
    parts.push(`<strong>Срок:</strong> ${data.estimatedDelivery}`)
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

export async function sendVerificationCode(email: string, code: string) {
  await transporter.sendMail({
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
}

export async function sendPasswordResetCode(email: string, code: string) {
  await transporter.sendMail({
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
}

// ── Order Status Email (for customer) ──

export async function sendOrderStatusEmail({
  to,
  customerName,
  orderNumber,
  newStatus,
}: {
  to: string
  customerName: string
  orderNumber: string
  newStatus: string
}) {
  const statusText = statusLabels[newStatus] || newStatus

  await transporter.sendMail({
    from: `"Millor Coffee" <${fromEmail}>`,
    to,
    subject: `Заказ ${orderNumber} — ${statusText}`,
    html: wrapEmail(`
      <h2 style="color: #7c4a1e; margin-bottom: 16px;">Статус заказа обновлён</h2>
      <p style="color: #555; font-size: 16px; line-height: 1.5;">
        ${customerName}, ваш заказ <strong>${orderNumber}</strong> получил новый статус:
      </p>
      <div style="background: #f5f0eb; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
        <span style="font-size: 20px; font-weight: bold; color: #7c4a1e;">${statusText}</span>
      </div>
      <p style="color: #888; font-size: 14px;">
        Следить за заказом можно в <a href="${siteUrl}/account/orders" style="color: #7c4a1e;">личном кабинете</a>.
      </p>
    `),
  })
}

// ── Customer: Order Confirmation ──

export async function sendOrderConfirmationEmail(data: OrderEmailData) {
  if (!data.customerEmail) return

  const html = wrapEmail(`
    <h2 style="color: #7c4a1e; margin-bottom: 16px;">Заказ оформлен</h2>
    <p style="color: #555; font-size: 16px; line-height: 1.5;">
      ${data.customerName}, спасибо за заказ <strong>${data.orderNumber}</strong>!
    </p>

    ${buildItemsTableHtml(data.items)}
    ${buildTotalsHtml(data)}
    ${buildDeliveryHtml(data)}

    <p style="color: #888; font-size: 14px; margin-top: 24px;">
      Следить за заказом можно в <a href="${siteUrl}/account/orders" style="color: #7c4a1e;">личном кабинете</a>.
    </p>
  `)

  await transporter.sendMail({
    from: `"Millor Coffee" <${fromEmail}>`,
    to: data.customerEmail,
    subject: `Заказ ${data.orderNumber} оформлен — Millor Coffee`,
    html,
  })
}

// ── Customer: Payment Success ──

export async function sendPaymentSuccessEmail(data: OrderEmailData) {
  if (!data.customerEmail) return

  const html = wrapEmail(`
    <h2 style="color: #2d6b4a; margin-bottom: 16px;">Оплата прошла успешно</h2>
    <p style="color: #555; font-size: 16px; line-height: 1.5;">
      ${data.customerName}, оплата заказа <strong>${data.orderNumber}</strong> подтверждена!
    </p>

    ${buildItemsTableHtml(data.items)}
    ${buildTotalsHtml(data)}
    ${buildDeliveryHtml(data)}

    <p style="color: #555; font-size: 14px; margin-top: 24px;">
      Мы начинаем готовить ваш заказ к отправке. Уведомим, когда передадим его в доставку.
    </p>
    <p style="color: #888; font-size: 14px;">
      Следить за заказом можно в <a href="${siteUrl}/account/orders" style="color: #7c4a1e;">личном кабинете</a>.
    </p>
  `)

  await transporter.sendMail({
    from: `"Millor Coffee" <${fromEmail}>`,
    to: data.customerEmail,
    subject: `Оплата заказа ${data.orderNumber} подтверждена — Millor Coffee`,
    html,
  })
}

// ── Admin: New Order Notification ──

export async function sendAdminNewOrderEmail(data: OrderEmailData) {
  const paymentLabel = data.paymentMethod === "online" ? "Онлайн (YooKassa)" : "При получении"

  const html = wrapEmail(`
    <h2 style="color: #7c4a1e; margin-bottom: 16px;">Новый заказ ${data.orderNumber}</h2>

    <div style="background: #f9f7f4; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #333;">Покупатель</p>
      <p style="margin: 4px 0; font-size: 14px; color: #555;"><strong>Имя:</strong> ${data.customerName}</p>
      <p style="margin: 4px 0; font-size: 14px; color: #555;"><strong>Телефон:</strong> ${data.customerPhone}</p>
      ${data.customerEmail ? `<p style="margin: 4px 0; font-size: 14px; color: #555;"><strong>Email:</strong> ${data.customerEmail}</p>` : ""}
      ${data.notes ? `<p style="margin: 4px 0; font-size: 14px; color: #555;"><strong>Комментарий:</strong> ${data.notes}</p>` : ""}
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

  await transporter.sendMail({
    from: `"Millor Coffee" <${fromEmail}>`,
    to: ADMIN_NOTIFICATION_EMAIL,
    subject: `Новый заказ ${data.orderNumber} — ${data.customerName}, ${formatPrice(data.total)}₽`,
    html,
  })
}

// ── Admin: Payment Success Notification ──

export async function sendAdminPaymentSuccessEmail(data: OrderEmailData) {
  const html = wrapEmail(`
    <h2 style="color: #2d6b4a; margin-bottom: 16px;">Оплата получена: ${data.orderNumber}</h2>

    <div style="background: #e8f5e9; border-radius: 8px; padding: 16px; margin: 16px 0; text-align: center;">
      <span style="font-size: 24px; font-weight: bold; color: #2d6b4a;">${formatPrice(data.total)}₽</span>
    </div>

    <div style="background: #f9f7f4; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #333;">Покупатель</p>
      <p style="margin: 4px 0; font-size: 14px; color: #555;"><strong>Имя:</strong> ${data.customerName}</p>
      <p style="margin: 4px 0; font-size: 14px; color: #555;"><strong>Телефон:</strong> ${data.customerPhone}</p>
      ${data.customerEmail ? `<p style="margin: 4px 0; font-size: 14px; color: #555;"><strong>Email:</strong> ${data.customerEmail}</p>` : ""}
    </div>

    ${buildItemsTableHtml(data.items)}
    ${buildTotalsHtml(data)}
    ${buildDeliveryHtml(data)}

    <p style="margin-top: 24px;">
      <a href="${siteUrl}/admin/orders" style="display: inline-block; background: #2d6b4a; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">Открыть в админке</a>
    </p>
  `)

  await transporter.sendMail({
    from: `"Millor Coffee" <${fromEmail}>`,
    to: ADMIN_NOTIFICATION_EMAIL,
    subject: `Оплата ${data.orderNumber} — ${formatPrice(data.total)}₽ от ${data.customerName}`,
    html,
  })
}
