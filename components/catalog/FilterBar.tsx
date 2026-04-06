"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useState } from "react"
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

  const [filtersOpen, setFiltersOpen] = useState(!!hasActiveFilters)

  return (
    <div className="sticky top-16 z-30 bg-white/95 backdrop-blur-sm border-b border-border -mx-4 px-4 sm:-mx-6 sm:px-6 mb-6 pb-3 pt-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className={cn(
            "flex items-center gap-1.5 p-2 rounded-lg transition-colors",
            filtersOpen ? "text-primary" : "text-muted-foreground hover:text-foreground"
          )}
          title="Фильтры"
        >
          <SlidersHorizontal className="w-4 h-4" />
          {hasActiveFilters && (
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          )}
        </button>
        <div className="flex items-center gap-3">
          {hasActiveFilters && (
            <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-primary transition-colors">
              Сбросить
            </button>
          )}
          <select
            value={activeSort ?? ""}
            onChange={(e) => updateParams("sort", e.target.value || undefined)}
            className="h-10 sm:h-8 px-3 sm:px-2.5 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Filter rows — collapsible */}
      {filtersOpen && <div className="space-y-3 mt-3">
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
      </div>}
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
        "px-3 py-2 sm:py-1 rounded-full text-xs font-medium transition-all",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "bg-secondary/70 text-muted-foreground hover:bg-secondary hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}
