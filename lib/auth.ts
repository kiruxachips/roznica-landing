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
    // OAuth providers — only active if env vars are set
    ...(process.env.GOOGLE_CLIENT_ID
      ? [Google({ clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! })]
      : []),
    ...(process.env.YANDEX_CLIENT_ID
      ? [Yandex({ clientId: process.env.YANDEX_CLIENT_ID!, clientSecret: process.env.YANDEX_CLIENT_SECRET! })]
      : []),
    // VK ID (id.vk.ru) не через NextAuth-провайдер — @auth/core v5 не поддерживает кастомный
    // token.request, а VK требует device_id в обмене кода на токен. Реализовано в роутах
    // /api/auth/vk/start и /api/auth/callback/vk (см. app/api/auth/vk/*).
  ],
  callbacks: {
    async signIn({ user, account }) {
      // PrismaAdapter fills name/email/image on OAuth sign-in. Sync image → avatarUrl
      // (our UI reads avatarUrl). Non-blocking: never fail sign-in if DB sync errors.
      if (account?.type === "oauth" && user?.id && user?.image) {
        try {
          const existing = await prisma.user.findUnique({
            where: { id: user.id },
            select: { avatarUrl: true },
          })
          if (existing && !existing.avatarUrl) {
            await prisma.user.update({
              where: { id: user.id },
              data: { avatarUrl: user.image },
            })
          }
        } catch (e) {
          console.error("OAuth avatar sync failed:", e)
        }
      }
      return true
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.userType = (user as Record<string, unknown>).userType as string || "customer"
        if ((user as Record<string, unknown>).role) {
          token.role = (user as Record<string, unknown>).role as string
        }
        if ((user as Record<string, unknown>).status) {
          token.status = (user as Record<string, unknown>).status as string
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
