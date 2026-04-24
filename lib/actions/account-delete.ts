"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { auth, signOut } from "@/lib/auth"
import { sendRenderedEmail } from "@/lib/email"
import { generateToken } from "@/lib/tokens"

/**
 * Двухшаговое удаление аккаунта (152-ФЗ «право на удаление»):
 *
 * 1. `requestAccountDeletion()` — юзер нажал «Удалить» → генерируем
 *    одноразовый токен, шлём на email, показываем страницу «Проверьте почту».
 *
 * 2. `confirmAccountDeletion(token)` — юзер кликает в письме →
 *    - email/name/phone анонимизируются
 *    - deletedAt = now
 *    - consent.revokedAt = now для всех типов
 *    - OAuth-связи (Account) удаляются
 *    - Session/JWT инвалидируется (logout)
 *    - Заказы и BonusTransaction НЕ удаляются (сохранены с анонимизированным User)
 */

const DELETION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000 // 24 часа

export async function requestAccountDeletion(): Promise<{
  success: boolean
  error?: string
}> {
  const session = await auth()
  const userId = session?.user?.id
  const userType = (session?.user as Record<string, unknown> | undefined)?.userType

  if (!userId || userType !== "customer") {
    return { success: false, error: "Не авторизован" }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, deletedAt: true },
  })
  if (!user) return { success: false, error: "Пользователь не найден" }
  if (user.deletedAt) return { success: false, error: "Аккаунт уже удалён" }
  if (!user.email) {
    return {
      success: false,
      error: "Нет email для подтверждения. Задайте email в профиле или обратитесь в поддержку.",
    }
  }

  // Токен кладём в VerificationCode (переиспользуем существующую модель).
  const token = generateToken(32)
  await prisma.verificationCode.create({
    data: {
      email: user.email,
      code: token,
      type: "account_delete",
      expiresAt: new Date(Date.now() + DELETION_TOKEN_TTL_MS),
    },
  })

  const siteUrl = process.env.NEXTAUTH_URL || "https://millor-coffee.ru"
  const confirmUrl = `${siteUrl}/account/delete/confirm?token=${encodeURIComponent(token)}`

  await sendRenderedEmail({
    to: user.email,
    subject: "Подтверждение удаления аккаунта Millor Coffee",
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 540px; margin: 0 auto;">
        <h2 style="color: #2d6b4a;">Подтвердите удаление аккаунта</h2>
        <p>Здравствуйте${user.name ? ", " + user.name : ""}!</p>
        <p>Вы запросили удаление своего аккаунта на millor-coffee.ru.</p>
        <p>После подтверждения:</p>
        <ul>
          <li>Имя, email и телефон в профиле будут анонимизированы.</li>
          <li>История заказов сохранится для бухгалтерской отчётности, но без привязки к вашему имени.</li>
          <li>Накопленные бонусы будут аннулированы.</li>
          <li>Вход в аккаунт станет невозможен.</li>
        </ul>
        <p style="margin: 24px 0;">
          <a href="${confirmUrl}" style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
            Подтвердить удаление
          </a>
        </p>
        <p style="color: #777; font-size: 13px;">Ссылка действует 24 часа. Если вы не запрашивали удаление, проигнорируйте это письмо.</p>
      </div>
    `,
  })

  return { success: true }
}

export async function confirmAccountDeletion(
  token: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return { success: false, error: "Не авторизован" }

  const verif = await prisma.verificationCode.findFirst({
    where: {
      code: token,
      type: "account_delete",
      used: false,
      expiresAt: { gt: new Date() },
    },
  })
  if (!verif) return { success: false, error: "Ссылка недействительна или истекла" }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  })
  if (!user?.email || user.email !== verif.email) {
    return { success: false, error: "Токен не соответствует текущему аккаунту" }
  }

  // Порядок операций критичен (см. post-audit fix):
  // 1) СНАЧАЛА удаляем OAuth Account'ы — после этого невозможен повторный
  //    вход через Google/Yandex/VK даже если последующие update упадут.
  // 2) Потом метим токен как used, чтобы ссылка не сработала повторно.
  // 3) Потом анонимизируем User (email→anon, deletedAt=now) и revoke consents.
  // Если транзакция упадёт на шаге 3, у нас уже нет OAuth-ссылок → юзер не
  // может залогиниться (Account нет, email anonymized не даст match в
  // authorize). Хуже чем полное удаление, но лучше чем несанкционированный
  // вход в старый аккаунт.
  await prisma.$transaction(async (tx) => {
    // Step 1: убить OAuth
    await tx.account.deleteMany({ where: { userId } })

    // Step 2: пометить verification token как использованный
    await tx.verificationCode.update({
      where: { id: verif.id },
      data: { used: true },
    })

    // Step 3: анонимизировать User
    const anonSuffix = Date.now()
    await tx.user.update({
      where: { id: userId },
      data: {
        email: `deleted-${userId}-${anonSuffix}@anon.local`,
        name: "Удалённый пользователь",
        phone: null,
        image: null,
        avatarUrl: null,
        defaultAddress: null,
        telegramId: null,
        passwordHash: null,
        bonusBalance: 0,
        notifyOrderStatus: false,
        notifyPromotions: false,
        notifyNewProducts: false,
        tasteProfile: undefined,
        deletedAt: new Date(),
      },
    })

    // Step 4: revoke consent'ы
    await tx.userConsent.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  })

  // Сбрасываем сессию. После signOut редирект на главную.
  await signOut({ redirect: false })
  revalidatePath("/account")
  redirect("/?account=deleted")
}
