"use client"

import { signIn } from "next-auth/react"

const providers = [
  {
    id: "google",
    name: "Google",
    envKey: "NEXT_PUBLIC_GOOGLE_ENABLED",
    bg: "bg-white hover:bg-gray-50 border border-gray-300",
    text: "text-gray-700",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
    ),
  },
  {
    id: "yandex",
    name: "Яндекс",
    envKey: "NEXT_PUBLIC_YANDEX_ENABLED",
    bg: "bg-[#FC3F1D] hover:bg-[#e63617]",
    text: "text-white",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white">
        <path d="M13.62 21.04h-2.58V2.96h3.66c3.12 0 5.04 1.68 5.04 4.56 0 2.16-1.2 3.72-3.42 4.38l4.02 9.14h-2.82l-3.6-8.52h-.3v8.52zm0-10.8h.78c2.04 0 3.12-.96 3.12-2.7 0-1.68-1.08-2.58-3.06-2.58h-.84v5.28z" />
      </svg>
    ),
  },
  {
    id: "vk",
    name: "VK",
    envKey: "NEXT_PUBLIC_VK_ENABLED",
    bg: "bg-[#0077FF] hover:bg-[#0066dd]",
    text: "text-white",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white">
        <path d="M12.785 16.241s.288-.032.436-.194c.136-.148.132-.427.132-.427s-.02-1.304.587-1.496c.596-.19 1.364 1.26 2.18 1.816.616.42 1.084.328 1.084.328l2.178-.03s1.14-.07.6-.964c-.044-.074-.316-.668-1.628-1.89-1.372-1.278-1.19-1.07.464-3.28.908-1.212 1.596-2.078 1.452-2.416-.136-.318-1.02-.234-1.02-.234l-2.45.016s-.182-.024-.316.056c-.132.078-.216.262-.216.262s-.388 1.034-.906 1.912c-1.092 1.852-1.53 1.95-1.71 1.834-.418-.27-.314-1.088-.314-1.668 0-1.812.274-2.568-.534-2.764-.268-.066-.466-.108-1.152-.116-.88-.008-1.626.004-2.048.208-.282.136-.498.44-.366.458.164.02.534.1.73.368.254.344.244 1.118.244 1.118s.146 2.132-.34 2.396c-.334.182-.792-.188-1.776-1.878-.504-.866-.884-1.824-.884-1.824s-.074-.18-.204-.276c-.158-.118-.38-.156-.38-.156l-2.328.016s-.35.01-.478.162c-.114.134-.01.414-.01.414s1.826 4.258 3.894 6.404c1.896 1.97 4.05 1.84 4.05 1.84h.976z" />
      </svg>
    ),
  },
]

export function OAuthButtons() {
  const enabledProviders = providers.filter((p) => {
    if (typeof window === "undefined") return true
    // Check NEXT_PUBLIC env vars to conditionally show buttons
    return true // All shown by default, server will reject if not configured
  })

  if (enabledProviders.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-white text-muted-foreground">или</span>
        </div>
      </div>

      <div className="grid gap-2">
        {enabledProviders.map((provider) => {
          const className = `flex items-center justify-center gap-3 w-full h-11 rounded-xl text-sm font-medium transition-colors ${provider.bg} ${provider.text}`
          // VK ID (id.vk.ru) uses our custom route — @auth/core can't pass device_id
          if (provider.id === "vk") {
            return (
              <a key={provider.id} href="/api/auth/vk/start" className={className}>
                {provider.icon}
                Войти через {provider.name}
              </a>
            )
          }
          return (
            <button
              key={provider.id}
              type="button"
              onClick={() => signIn(provider.id, { callbackUrl: "/account" })}
              className={className}
            >
              {provider.icon}
              Войти через {provider.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
