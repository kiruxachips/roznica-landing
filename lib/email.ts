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

export async function sendVerificationCode(email: string, code: string) {
  await transporter.sendMail({
    from: `"Millor Coffee" <${fromEmail}>`,
    to: email,
    subject: "Код подтверждения — Millor Coffee",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
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
      </div>
    `,
  })
}

const statusLabels: Record<string, string> = {
  pending: "Ожидает обработки",
  confirmed: "Подтверждён",
  shipped: "Отправлен",
  delivered: "Доставлен",
  cancelled: "Отменён",
}

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
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #7c4a1e; margin-bottom: 16px;">Статус заказа обновлён</h2>
        <p style="color: #555; font-size: 16px; line-height: 1.5;">
          ${customerName}, ваш заказ <strong>${orderNumber}</strong> получил новый статус:
        </p>
        <div style="background: #f5f0eb; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
          <span style="font-size: 20px; font-weight: bold; color: #7c4a1e;">${statusText}</span>
        </div>
        <p style="color: #888; font-size: 14px;">
          Следить за заказом можно в <a href="https://millor-coffee.ru/account/orders" style="color: #7c4a1e;">личном кабинете</a>.
        </p>
      </div>
    `,
  })
}

export async function sendPasswordResetCode(email: string, code: string) {
  await transporter.sendMail({
    from: `"Millor Coffee" <${fromEmail}>`,
    to: email,
    subject: "Сброс пароля — Millor Coffee",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
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
      </div>
    `,
  })
}
