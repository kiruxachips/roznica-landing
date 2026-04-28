"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { X, Globe, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { getCountryFlag, pluralizeSorts } from "@/lib/constants"

interface OriginStat {
  name: string
  count: number
}

interface Props {
  open: boolean
  onClose: () => void
  origins: OriginStat[]
  activeOrigin?: string
  // Сорт/поиск пробрасываем, чтобы выбор страны не сбивал контекст.
  preserveSort?: string
  preserveSearch?: string
}

export function OriginPicker({
  open,
  onClose,
  origins,
  activeOrigin,
  preserveSort,
  preserveSearch,
}: Props) {
  const router = useRouter()
  const dialogRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  // SSR-safe portal: createPortal требует document, поэтому рендерим только
  // после монтирования. До этого попап вообще не выводится (он закрыт).
  useEffect(() => {
    setMounted(true)
  }, [])

  // iOS-safe body-scroll-lock: `overflow: hidden` на body Mobile Safari
  // игнорирует (scroll chaining через bottom-sheet прокручивает фон).
  // Решение — `position: fixed` + сохранение/восстановление scrollY.
  // Esc слушаем здесь же, чтобы не плодить эффекты.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)

    const scrollY = window.scrollY
    const body = document.body
    const prev = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    }
    body.style.position = "fixed"
    body.style.top = `-${scrollY}px`
    body.style.width = "100%"
    body.style.overflow = "hidden"

    return () => {
      document.removeEventListener("keydown", onKey)
      body.style.position = prev.position
      body.style.top = prev.top
      body.style.width = prev.width
      body.style.overflow = prev.overflow
      window.scrollTo(0, scrollY)
    }
  }, [open, onClose])

  // Фокус-trap: keydown слушаем на самом dialog (не на document), чтобы
  // не конфликтовать с другими компонентами вроде CartDrawer. При закрытии
  // возвращаем фокус на trigger, если он ещё в DOM.
  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    if (!dialog) return

    const previouslyFocused = document.activeElement as HTMLElement | null

    const focusables = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute("data-focus-skip"))

    const firstFocusable = focusables().find(
      (el) => el.dataset.originPickerPrimary === "true"
    ) ?? focusables()[0]
    firstFocusable?.focus()

    const onTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return
      const list = focusables()
      if (list.length === 0) return
      const first = list[0]
      const last = list[list.length - 1]
      const active = document.activeElement
      // Если фокус как-то вылетел за пределы попапа (теоретически невозможно
      // при `position: fixed` body-lock, но страховка) — вернуть на первый.
      if (!dialog.contains(active)) {
        e.preventDefault()
        first.focus()
        return
      }
      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    dialog.addEventListener("keydown", onTab)
    return () => {
      dialog.removeEventListener("keydown", onTab)
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus()
      }
    }
  }, [open])

  if (!open || !mounted) return null

  const selectOrigin = (name: string | null) => {
    const params = new URLSearchParams()
    params.set("type", "coffee")
    if (name) params.set("origin", name)
    if (preserveSort) params.set("sort", preserveSort)
    if (preserveSearch) params.set("q", preserveSearch)
    router.push(`/catalog?${params.toString()}`)
    onClose()
  }

  const content = (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Выбрать кофе по стране"
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
    >
      <button
        type="button"
        aria-label="Закрыть"
        onClick={onClose}
        data-focus-skip
        tabIndex={-1}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-overlay-in"
      />

      <div
        className={cn(
          "relative w-full sm:max-w-3xl bg-white shadow-xl",
          "rounded-t-2xl sm:rounded-2xl",
          "max-h-[88vh] sm:max-h-[80vh] flex flex-col",
          "animate-sheet-in sm:animate-modal-in"
        )}
      >
        {/* Drag-handle (мобилка): визуальная подсказка, что это bottom sheet. */}
        <div className="sm:hidden pt-2 pb-1 flex justify-center" aria-hidden="true">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="flex items-center justify-between px-5 sm:px-6 pt-3 sm:pt-6 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" aria-hidden="true" />
            <h2 className="font-sans text-lg sm:text-xl font-bold">
              Кофе по странам
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            data-focus-skip
            className="w-9 h-9 rounded-full hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4">
          {origins.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Пока нет данных о странах происхождения
            </p>
          ) : (
            <>
              <p className="text-xs sm:text-sm text-muted-foreground mb-4">
                Выберите страну происхождения, и мы покажем все сорта оттуда.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                {origins.map((o, i) => {
                  const isActive = activeOrigin === o.name
                  // Первая фокусируемая кнопка для focus-trap — активная страна
                  // или первая в списке (если ничего не выбрано).
                  const isPrimary = isActive || (!activeOrigin && i === 0)
                  return (
                    <button
                      key={o.name}
                      type="button"
                      onClick={() => selectOrigin(o.name)}
                      data-origin-picker-primary={isPrimary ? "true" : undefined}
                      className={cn(
                        "group relative flex items-center gap-3 px-3 sm:px-4 py-3 rounded-xl border text-left transition-all",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                        isActive
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-white hover:border-primary/40 hover:bg-primary/5"
                      )}
                    >
                      <span className="text-2xl sm:text-3xl shrink-0 leading-none" aria-hidden="true">
                        {getCountryFlag(o.name)}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold truncate">
                          {o.name}
                        </span>
                        <span
                          className={cn(
                            "block text-xs",
                            isActive ? "text-primary/70" : "text-muted-foreground"
                          )}
                        >
                          {pluralizeSorts(o.count)}
                        </span>
                      </span>
                      {isActive && (
                        <Check className="w-4 h-4 shrink-0 text-primary" aria-hidden="true" />
                      )}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {origins.length > 0 && (
          <div className="border-t border-border px-5 sm:px-6 py-3 flex items-center justify-between gap-3">
            {activeOrigin ? (
              <button
                type="button"
                onClick={() => selectOrigin(null)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded px-1"
              >
                Сбросить страну
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 h-9 rounded-lg bg-secondary text-sm font-medium hover:bg-secondary/80 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              Закрыть
            </button>
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
