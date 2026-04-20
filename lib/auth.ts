import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import Yandex from "next-auth/providers/yandex"
import { PrismaAdapter } from "@auth/prisma-adapter"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
// Dynamic import to avoid Edge Runtime issues with Node.js crypto module
const getTelegramModule = () => import("@/lib/telegram-auth")

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

        const user = await prisma.adminUser.findUnique({
          where: { email: credentials.email as string },
        })
        if (!user) return null

        const isValid = await bcrypt.compare(credentials.password as string, user.passwordHash)
        if (!isValid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
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

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        })
        if (!user || !user.passwordHash) return null
        if (!user.emailVerified) return null

        const isValid = await bcrypt.compare(credentials.password as string, user.passwordHash)
        if (!isValid) return null

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
    async signIn() {
      return true
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.userType = (user as Record<string, unknown>).userType as string || "customer"
        if ((user as Record<string, unknown>).role) {
          token.role = (user as Record<string, unknown>).role as string
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
      }
      return session
    },
  },
  pages: {
    signIn: "/auth/login",
  },
  session: {
    strategy: "jwt",
  },
  trustHost: true,
})
