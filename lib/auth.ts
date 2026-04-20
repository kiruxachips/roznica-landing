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
    // VK ID (новая платформа id.vk.ru, OAuth 2.1 с PKCE — несовместима с устаревшим oauth.vk.com)
    ...(process.env.VK_CLIENT_ID
      ? [{
          id: "vk",
          name: "ВКонтакте",
          type: "oauth" as const,
          authorization: {
            url: "https://id.vk.ru/authorize",
            params: {
              response_type: "code",
              scope: "vkid.personal_info email",
            },
          },
          token: {
            url: "https://id.vk.ru/oauth2/auth",
            // VK ID requires device_id (from callback params) — not standard OAuth 2.0
            async request(context: Record<string, unknown>) {
              const provider = context.provider as Record<string, string>
              const params = context.params as Record<string, string>
              const checks = context.checks as Record<string, string>
              const body = new URLSearchParams({
                grant_type: "authorization_code",
                code: params.code,
                redirect_uri: provider.callbackUrl,
                client_id: provider.clientId,
                client_secret: provider.clientSecret,
              })
              if (checks.code_verifier) body.set("code_verifier", checks.code_verifier)
              if (params.device_id) body.set("device_id", params.device_id)
              const res = await fetch("https://id.vk.ru/oauth2/auth", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: body.toString(),
              })
              const tokens = await res.json()
              return { tokens }
            },
          },
          userinfo: {
            url: "https://api.vk.com/method/users.get",
            request: async ({ tokens }: { tokens: { access_token: string; id_token?: string } }) => {
              // VK ID embeds user info (incl. email) in id_token JWT — decode it directly
              if (tokens.id_token) {
                try {
                  const payload = JSON.parse(
                    Buffer.from(tokens.id_token.split(".")[1], "base64url").toString("utf8")
                  )
                  // Enrich with photo from VK API (id_token doesn't include photo_200)
                  const res = await fetch(
                    `https://api.vk.com/method/users.get?fields=photo_200&access_token=${encodeURIComponent(tokens.access_token)}&v=5.199`
                  )
                  const apiData = await res.json()
                  const apiUser = apiData.response?.[0] ?? {}
                  return { ...payload, photo_200: apiUser.photo_200 }
                } catch {
                  // fall through to VK API below
                }
              }
              const res = await fetch(
                `https://api.vk.com/method/users.get?fields=photo_200&access_token=${encodeURIComponent(tokens.access_token)}&v=5.199`
              )
              const data = await res.json()
              return data.response?.[0] ?? {}
            },
          },
          checks: ["pkce"] as ("pkce" | "state" | "none")[],
          client: { token_endpoint_auth_method: "client_secret_post" },
          clientId: process.env.VK_CLIENT_ID!,
          clientSecret: process.env.VK_CLIENT_SECRET!,
          profile(profile: Record<string, unknown>) {
            // id_token payload uses 'sub' as user ID; VK API uses 'id'
            const id = String(profile.sub ?? profile.id ?? "")
            return {
              id,
              name: [profile.first_name, profile.last_name].filter(Boolean).join(" ") || null,
              email: (profile.email as string) ?? null,
              image: (profile.photo_200 as string) ?? (profile.avatar as string) ?? null,
            }
          },
        }]
      : []),
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
