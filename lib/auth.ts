import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import Yandex from "next-auth/providers/yandex"
import { PrismaAdapter } from "@auth/prisma-adapter"
import bcrypt from "bcryptjs"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import { checkRateLimit, resetRateLimit, RATE_LIMITS } from "@/lib/rate-limit"
// Dynamic import to avoid Edge Runtime issues with Node.js crypto module
const getTelegramModule = () => import("@/lib/telegram-auth")

/**
 * Извлекает IP клиента из заголовков reverse-proxy.
 * На Beget-deploy'е фронт прокси (nginx или cloudflare) проставляет
 * X-Forwarded-For первым адресом — его и берём.
 */
async function getClientIp(): Promise<string> {
  const h = await headers()
  const forwarded = h.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0]!.trim()
  return h.get("x-real-ip") || "unknown"
}

class AuthError extends Error {}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    // Admin credentials
    Credentials({
      id: "admin-credentials",
      name: "Admin",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const email = String(credentials.email).toLowerCase().trim()
        const ip = await getClientIp()
        const rlKey = `admin-login:${email}:${ip}`
        const rl = checkRateLimit(rlKey, RATE_LIMITS.login)
        if (!rl.allowed) {
          throw new AuthError(
            `Слишком много попыток входа. Попробуйте через ${Math.ceil((rl.retryAfter || 60) / 60)} мин.`
          )
        }

        const user = await prisma.adminUser.findUnique({
          where: { email },
        })
        if (!user) return null

        const isValid = await bcrypt.compare(credentials.password as string, user.passwordHash)
        if (!isValid) return null

        // Блокируем pending (не одобрен) и blocked (заблокирован админом).
        // Активный статус — единственный, при котором можно войти.
        if (user.status !== "active") {
          throw new AuthError(
            user.status === "pending"
              ? "Аккаунт ожидает одобрения администратором"
              : "Аккаунт заблокирован"
          )
        }

        // Успешный логин — сбрасываем счётчик попыток
        resetRateLimit(rlKey)

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
          userType: "admin" as const,
        }
      },
    }),
    // Customer email+password
    Credentials({
      id: "customer-credentials",
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        // Нормализация email: регистрация и reset могут сохранять его
        // в разном регистре, а Postgres text comparison case-sensitive.
        // Без .toLowerCase().trim() "John@X.com" и "john@x.com" для БД
        // разные адреса → пользователь не находится, ошибка логина.
        const email = String(credentials.email).toLowerCase().trim()
        const ip = await getClientIp()
        const rlKey = `customer-login:${email}:${ip}`
        const rl = checkRateLimit(rlKey, RATE_LIMITS.login)
        if (!rl.allowed) {
          throw new AuthError(
            `Слишком много попыток входа. Попробуйте через ${Math.ceil((rl.retryAfter || 60) / 60)} мин.`
          )
        }

        const user = await prisma.user.findUnique({ where: { email } })
        if (!user || !user.passwordHash) return null
        if (!user.emailVerified) return null
        // Soft-deleted юзер не должен иметь возможность войти. Email у него
        // анонимизирован (deleted-{id}-{ts}@anon.local), но на всякий случай
        // двойная проверка.
        if (user.deletedAt) return null

        const isValid = await bcrypt.compare(credentials.password as string, user.passwordHash)
        if (!isValid) return null

        resetRateLimit(rlKey)

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          userType: "customer" as const,
        }
      },
    }),
    // Wholesale (B2B) email+password
    Credentials({
      id: "wholesale-credentials",
      name: "Wholesale",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const email = String(credentials.email).toLowerCase().trim()
        const ip = await getClientIp()
        const rlKey = `wholesale-login:${email}:${ip}`
        const rl = checkRateLimit(rlKey, RATE_LIMITS.login)
        if (!rl.allowed) {
          throw new AuthError(
            `Слишком много попыток входа. Попробуйте через ${Math.ceil((rl.retryAfter || 60) / 60)} мин.`
          )
        }

        const user = await prisma.wholesaleUser.findUnique({
          where: { email },
          include: { company: { select: { id: true, status: true } } },
        })
        if (!user || !user.passwordHash) return null
        // Email подтверждается в момент апрува заявки — unverified не должен входить
        if (!user.emailVerified) {
          throw new AuthError("Email не подтверждён. Проверьте почту или задайте пароль по ссылке из письма.")
        }
        if (user.status !== "active") {
          throw new AuthError("Учётная запись заблокирована. Свяжитесь с менеджером.")
        }
        if (user.company.status === "rejected") {
          throw new AuthError("Компания отклонена в доступе к оптовому кабинету.")
        }

        const isValid = await bcrypt.compare(credentials.password as string, user.passwordHash)
        if (!isValid) return null

        resetRateLimit(rlKey)

        // Обновляем lastLoginAt (не блокирующе)
        prisma.wholesaleUser.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        }).catch(() => {})

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          userType: "wholesale" as const,
          companyId: user.company.id,
          companyStatus: user.company.status,
        }
      },
    }),
    // Telegram Login Widget
    Credentials({
      id: "telegram",
      name: "Telegram",
      credentials: {
        telegramData: { label: "Telegram Data", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.telegramData) return null

        const data = JSON.parse(credentials.telegramData as string)
        const { verifyTelegramAuth, getTelegramDisplayName } = await getTelegramModule()
        if (!verifyTelegramAuth(data)) return null

        // P2-10: защита от replay перехваченного widget-пакета.
        // Telegram подписывает всё, включая hash; используем hash как nonce.
        // Если он уже обрабатывался — отклоняем (второй логин с тем же data).
        try {
          await prisma.processedInboundEvent.create({
            data: { source: "telegram-login", eventId: String(data.hash) },
          })
        } catch (e) {
          const err = e as { code?: string }
          if (err?.code === "P2002") {
            // Hash уже использован — это replay.
            return null
          }
          throw e
        }

        // Find or create user by telegramId
        let user = await prisma.user.findUnique({
          where: { telegramId: String(data.id) },
        })

        if (!user) {
          user = await prisma.user.create({
            data: {
              telegramId: String(data.id),
              name: getTelegramDisplayName(data),
              avatarUrl: data.photo_url || null,
            },
          })
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatarUrl,
          userType: "customer" as const,
        }
      },
    }),
    // OAuth providers — only active if env vars are set.
    // PS2: кастомный profile() нормализует email ДО того как PrismaAdapter
    // создаст запись — юзер в БД сразу с lowercase email, без post-hoc update.
    ...(process.env.GOOGLE_CLIENT_ID
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            profile(profile) {
              return {
                id: profile.sub,
                name: profile.name,
                email: profile.email ? String(profile.email).toLowerCase().trim() : null,
                image: profile.picture,
              }
            },
          }),
        ]
      : []),
    ...(process.env.YANDEX_CLIENT_ID
      ? [
          Yandex({
            clientId: process.env.YANDEX_CLIENT_ID!,
            clientSecret: process.env.YANDEX_CLIENT_SECRET!,
            profile(profile) {
              const p = profile as unknown as Record<string, unknown>
              return {
                id: String(p.id),
                name:
                  (p.display_name as string) ||
                  (p.real_name as string) ||
                  (p.login as string),
                email: p.default_email
                  ? String(p.default_email).toLowerCase().trim()
                  : null,
                image:
                  p.is_avatar_empty === false && p.default_avatar_id
                    ? `https://avatars.yandex.net/get-yapic/${p.default_avatar_id}/islands-200`
                    : null,
              }
            },
          }),
        ]
      : []),
    // VK ID (id.vk.ru) не через NextAuth-провайдер — @auth/core v5 не поддерживает кастомный
    // token.request, а VK требует device_id в обмене кода на токен. Реализовано в роутах
    // /api/auth/vk/start и /api/auth/callback/vk (см. app/api/auth/vk/*).
  ],
  callbacks: {
    async signIn({ user, account }) {
      // PrismaAdapter fills name/email/image on OAuth sign-in. Дополнительно:
      //   - Sync image → avatarUrl (UI читает avatarUrl)
      //   - PS2: нормализуем email в lower-case. Если OAuth-провайдер вернул
      //     "John@X.com", Postgres text case-sensitive → все последующие
      //     lookup'ы по lower-case не найдут юзера. Делаем это DO-blocking:
      //     если нормализация упирается в unique-constraint (дубль), не
      //     блокируем signIn — legacy-пользователь войдёт, fix будет при
      //     миграции consolidated.
      if (account?.type === "oauth" && user?.id) {
        try {
          const existing = await prisma.user.findUnique({
            where: { id: user.id },
            select: { avatarUrl: true, email: true },
          })
          if (existing) {
            const updates: Record<string, string> = {}
            if (!existing.avatarUrl && user.image) {
              updates.avatarUrl = user.image
            }
            if (existing.email && existing.email !== existing.email.toLowerCase()) {
              updates.email = existing.email.toLowerCase()
            }
            if (Object.keys(updates).length > 0) {
              await prisma.user.update({
                where: { id: user.id },
                data: updates,
              }).catch((e) => {
                // P2002 на email-duplicate — уже есть lower-case юзер.
                // Оставляем как было, не блокируем вход.
                const err = e as { code?: string }
                if (err?.code !== "P2002") throw e
              })
            }
          }
        } catch (e) {
          console.error("OAuth post-signin sync failed:", e)
        }
      }
      return true
    },
    async jwt({ token, user, account }) {
      if (user) {
        const u = user as Record<string, unknown>
        token.userType = (u.userType as "admin" | "customer" | "wholesale") || "customer"
        if (u.role) {
          token.role = u.role as string
        }
        if (u.status) {
          token.status = u.status as string
        }
        if (u.companyId) {
          token.companyId = u.companyId as string
        }
        if (u.companyStatus) {
          token.companyStatus = u.companyStatus as string
        }
      }
      // For OAuth, always set customer
      if (account?.type === "oauth") {
        token.userType = "customer"
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!
        const user = session.user as unknown as Record<string, unknown>
        user.userType = token.userType
        if (token.role) {
          user.role = token.role
        }
        if (token.status) {
          user.status = token.status
        }
        if (token.companyId) {
          user.companyId = token.companyId
        }
        if (token.companyStatus) {
          user.companyStatus = token.companyStatus
        }
      }
      return session
    },
  },
  pages: {
    signIn: "/auth/login",
  },
  session: {
    strategy: "jwt",
    // P1-5: default NextAuth — 30 дней; слишком долго для финсистемы.
    // 7 дней — реалистичный trade-off между UX (не разлогинивать юзера
    // каждый день) и риском при утечке JWT/устройства.
    maxAge: 7 * 24 * 60 * 60,
  },
  trustHost: true,
})
