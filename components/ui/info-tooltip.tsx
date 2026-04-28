"use client"

import { useEffect, useRef, useState } from "react"
import { Info } from "lucide-react"
import { cn } from "@/lib/utils"

interface InfoTooltipProps {
  text: string
  className?: string
  iconClassName?: string
  iconSize?: "xs" | "sm"
  placement?: "top" | "bottom"
  align?: "start" | "center" | "end"
  ariaLabel?: string
}

/**
 * (i) с тултипом. Использует <span role="button"> а не <button>, чтобы
 * безопасно вкладываться внутрь карточек-кнопок (carrier cards и т.п.).
 * Hover показывает тултип на десктопе, тап — на мобильных. Click outside
 * закрывает.
 */
export function InfoTooltip({
  text,
  className,
  iconClassName,
  iconSize = "sm",
  placement = "top",
  align = "center",
  ariaLabel = "Подробнее",
}: InfoTooltipProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [open])

  const iconSizeClass = iconSize === "xs" ? "w-3 h-3" : "w-3.5 h-3.5"
  const alignClass =
    align === "start"
      ? "left-0"
      : align === "end"
      ? "right-0"
      : "left-1/2 -translate-x-1/2"

  return (
    <span
      ref={wrapRef}
      className={cn("relative inline-flex align-middle", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          setOpen((v) => !v)
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            e.stopPropagation()
            setOpen((v) => !v)
          }
          if (e.key === "Escape") setOpen(false)
        }}
        className={cn(
          "inline-flex items-center justify-center rounded-full text-current opacity-60 hover:opacity-100 cursor-help focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 transition-opacity",
          iconClassName
        )}
      >
        <Info className={iconSizeClass} strokeWidth={2} />
      </span>
      {open && (
        <span
          role="tooltip"
          className={cn(
            "absolute z-50 w-60 max-w-[80vw] px-3 py-2 rounded-lg bg-foreground text-background text-xs leading-relaxed shadow-lg whitespace-normal font-normal text-left",
            placement === "top" ? "bottom-full mb-2" : "top-full mt-2",
            alignClass
          )}
        >
          {text}
        </span>
      )}
    </span>
  )
}
