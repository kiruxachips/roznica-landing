"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"
import { SlidersHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"

interface FilterBarProps {
  filterOptions: {
    origins: string[]
    roastLevels: string[]
    brewingMethods: string[]
  }
  activeRoast?: string
  activeOrigin?: string
  activeBrewing?: string
  activeSort?: string
}

const brewingLabels: Record<string, string> = {
  espresso: "Эспрессо",
  filter: "Фильтр",
  "french-press": "Френч-пресс",
  turka: "Турка",
  aeropress: "Аэропресс",
  moka: "Мока",
}

const sortOptions = [
  { value: "", label: "По умолчанию" },
  { value: "price-asc", label: "Сначала дешёвые" },
  { value: "price-desc", label: "Сначала дорогие" },
  { value: "newest", label: "Новинки" },
]

export function FilterBar({ filterOptions, activeRoast, activeOrigin, activeBrewing, activeSort }: FilterBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const updateParams = useCallback(
    (key: string, value: string | undefined) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      params.delete("page")
      router.push(`/catalog?${params.toString()}`)
    },
    [router, searchParams]
  )

  const hasActiveFilters = activeRoast || activeOrigin || activeBrewing

  const clearAll = useCallback(() => {
    const params = new URLSearchParams()
    if (activeSort) params.set("sort", activeSort)
    router.push(`/catalog?${params.toString()}`)
  }, [router, activeSort])

  return (
    <div className="mb-8 rounded-xl border border-border/60 bg-white p-4 sm:p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <SlidersHorizontal className="w-4 h-4" />
          Фильтры
        </div>
        <div className="flex items-center gap-3">
          {hasActiveFilters && (
            <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-primary transition-colors">
              Сбросить
            </button>
          )}
          <select
            value={activeSort ?? ""}
            onChange={(e) => updateParams("sort", e.target.value || undefined)}
            className="h-8 px-2.5 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Filter rows */}
      <div className="space-y-3">
        {/* Roast levels */}
        <FilterRow label="Обжарка">
          <FilterPill active={!activeRoast} onClick={() => updateParams("roast", undefined)}>
            Все
          </FilterPill>
          {filterOptions.roastLevels.map((level) => (
            <FilterPill key={level} active={activeRoast === level} onClick={() => updateParams("roast", activeRoast === level ? undefined : level)}>
              {level}
            </FilterPill>
          ))}
        </FilterRow>

        {/* Origins */}
        {filterOptions.origins.length > 1 && (
          <FilterRow label="Страна">
            <FilterPill active={!activeOrigin} onClick={() => updateParams("origin", undefined)}>
              Все
            </FilterPill>
            {filterOptions.origins.map((origin) => (
              <FilterPill key={origin} active={activeOrigin === origin} onClick={() => updateParams("origin", activeOrigin === origin ? undefined : origin)}>
                {origin}
              </FilterPill>
            ))}
          </FilterRow>
        )}

        {/* Brewing methods */}
        {filterOptions.brewingMethods.length > 0 && (
          <FilterRow label="Заваривание">
            <FilterPill active={!activeBrewing} onClick={() => updateParams("brewing", undefined)}>
              Все
            </FilterPill>
            {filterOptions.brewingMethods.map((method) => (
              <FilterPill key={method} active={activeBrewing === method} onClick={() => updateParams("brewing", activeBrewing === method ? undefined : method)}>
                {brewingLabels[method] ?? method}
              </FilterPill>
            ))}
          </FilterRow>
        )}
      </div>
    </div>
  )
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground w-20 shrink-0">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {children}
      </div>
    </div>
  )
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1 rounded-full text-xs font-medium transition-all",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "bg-secondary/70 text-muted-foreground hover:bg-secondary hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}
