"use client"

import { useEffect } from "react"

/**
 * Клиентский трекер просмотров статьи. Раньше счётчик инкрементился в Server
 * Component (UPDATE на каждый GET → блокирует ISR-кеш). Теперь — POST при
 * монтировании, с защитой sessionStorage от повторных подсчётов в рамках
 * одной сессии.
 */
export function ArticleViewTracker({ articleId }: { articleId: string }) {
  useEffect(() => {
    if (typeof window === "undefined") return
    const key = `millor-article-viewed-${articleId}`
    if (sessionStorage.getItem(key) === "1") return
    sessionStorage.setItem(key, "1")
    // sendBeacon не блокирует unload, fetch fallback на случай если sendBeacon
    // не поддерживается / отключён CSP. Ошибки молча — счётчик не критичен.
    const body = JSON.stringify({ id: articleId })
    try {
      if ("sendBeacon" in navigator) {
        navigator.sendBeacon(
          "/api/blog/view-count",
          new Blob([body], { type: "application/json" })
        )
        return
      }
    } catch {
      // fallthrough to fetch
    }
    fetch("/api/blog/view-count", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {})
  }, [articleId])

  return null
}
