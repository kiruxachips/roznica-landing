"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Coffee } from "lucide-react"
import { cn } from "@/lib/utils"

export function StickyMobileCTA() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const hero = document.querySelector("section[data-home-hero]")
    const contact = document.getElementById("contact")

    let heroVisible = true
    let contactVisible = false

    const evaluate = () => setVisible(!heroVisible && !contactVisible)

    const heroObs = new IntersectionObserver(
      ([entry]) => {
        heroVisible = entry.isIntersecting
        evaluate()
      },
      { threshold: 0.2 }
    )
    const contactObs = new IntersectionObserver(
      ([entry]) => {
        contactVisible = entry.isIntersecting
        evaluate()
      },
      { threshold: 0.3 }
    )

    if (hero) heroObs.observe(hero)
    if (contact) contactObs.observe(contact)

    return () => {
      heroObs.disconnect()
      contactObs.disconnect()
    }
  }, [])

  return (
    <div
      role="complementary"
      aria-label="Быстрый переход в каталог"
      className={cn(
        "md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.08)] transition-transform duration-300",
        visible ? "translate-y-0" : "translate-y-full"
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="container mx-auto px-4 py-3 flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Coffee className="w-4 h-4 text-primary" strokeWidth={1.75} />
          </div>
          <div className="flex flex-col leading-tight min-w-0">
            <span className="text-sm font-semibold text-foreground">От 550₽</span>
            <span className="text-[11px] text-muted-foreground truncate">свежая обжарка · доставка 2-3 дня</span>
          </div>
        </div>
        <Link
          href="/catalog"
          className="shrink-0 h-11 px-4 bg-primary text-white rounded-xl text-sm font-semibold flex items-center gap-1.5 hover:bg-primary/90 active:scale-[0.98] transition-all"
        >
          Выбрать кофе
          <ArrowRight className="w-4 h-4" strokeWidth={2} />
        </Link>
      </div>
    </div>
  )
}
