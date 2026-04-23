"use client"

import { useEffect, useState } from "react"
import { ArrowUp } from "lucide-react"

/**
 * Плавающая кнопка "вверх". Показывается когда юзер проскроллил больше
 * `threshold` пикселей — не спамит на короткой странице. Клик — smooth-scroll
 * в начало. Полезно на длинных листингах каталога / блога.
 */
export function BackToTop({ threshold = 400 }: { threshold?: number }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > threshold)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener("scroll", onScroll)
  }, [threshold])

  if (!visible) return null

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Наверх"
      className="fixed bottom-6 right-4 sm:right-6 z-40 w-11 h-11 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 hover:shadow-xl transition-all flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <ArrowUp className="w-5 h-5" />
    </button>
  )
}
