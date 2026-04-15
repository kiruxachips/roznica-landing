"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useState } from "react"
import { SlidersHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ProductType } from "@/lib/types"

interface FilterOptions {
  origins: string[]
  roastLevels: string[]
  brewingMethods: string[]
  teaTypes: { name: string; slug: string }[]
  productForms: string[]
}

interface FilterBarProps {
  filterOptions: FilterOptions
  activeType?: ProductType
  activeRoast?: string
  activeOrigin?: string
  activeBrewing?: string
  activeTeaType?: string
  activeForm?: string
  activeSort?: string
}

const TYPE_TABS: { value: ProductType | ""; label: string }[] = [
  { value: "coffee", label: "Кофе" },
  { value: "tea", label: "Чай" },
  { value: "instant", label: "Растворимая" },
]

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

export function FilterBar({
  filterOptions,
  activeType,
  activeRoast,
  activeOrigin,
  activeBrewing,
  activeTeaType,
  activeForm,
  activeSort,
}: FilterBarProps) {
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

  const switchType = useCallback(
    (type: ProductType) => {
      // When switching tabs, drop all sub-filters, keep only sort
      const params = new URLSearchParams()
      params.set("type", type)
      if (activeSort) params.set("sort", activeSort)
      router.push(`/catalog?${params.toString()}`)
    },
    [router, activeSort]
  )

  const hasSubFilters = !!(activeRoast || activeOrigin || activeBrewing || activeTeaType || activeForm)

  const clearSubFilters = useCallback(() => {
    const params = new URLSearchParams()
    if (activeType) params.set("type", activeType)
    if (activeSort) params.set("sort", activeSort)
    router.push(`/catalog?${params.toString()}`)
  }, [router, activeType, activeSort])

  const [filtersOpen, setFiltersOpen] = useState(!!hasSubFilters)

  return (
    <div className="sticky top-16 z-30 bg-white/95 backdrop-blur-sm border-b border-border -mx-4 px-4 sm:-mx-6 sm:px-6 mb-6 pb-3 pt-3">
      {/* Product-type tabs */}
      <div className="flex items-center gap-1 mb-3">
        {TYPE_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => switchType(tab.value as ProductType)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all",
              activeType === tab.value || (!activeType && tab.value === "coffee")
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sort + sub-filters toggle */}
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
          {hasSubFilters && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
        </button>
        <div className="flex items-center gap-3">
          {hasSubFilters && (
            <button onClick={clearSubFilters} className="text-xs text-muted-foreground hover:text-primary transition-colors">
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

      {/* Sub-filters — collapsible, content varies by tab */}
      {filtersOpen && (
        <div className="space-y-3 mt-3">
          {/* COFFEE sub-filters */}
          {(!activeType || activeType === "coffee") && (
            <>
              {filterOptions.roastLevels.length > 0 && (
                <FilterRow label="Обжарка">
                  <FilterPill active={!activeRoast} onClick={() => updateParams("roast", undefined)}>Все</FilterPill>
                  {filterOptions.roastLevels.map((level) => (
                    <FilterPill key={level} active={activeRoast === level} onClick={() => updateParams("roast", activeRoast === level ? undefined : level)}>
                      {level}
                    </FilterPill>
                  ))}
                </FilterRow>
              )}
              {filterOptions.origins.length > 1 && (
                <FilterRow label="Страна">
                  <FilterPill active={!activeOrigin} onClick={() => updateParams("origin", undefined)}>Все</FilterPill>
                  {filterOptions.origins.map((origin) => (
                    <FilterPill key={origin} active={activeOrigin === origin} onClick={() => updateParams("origin", activeOrigin === origin ? undefined : origin)}>
                      {origin}
                    </FilterPill>
                  ))}
                </FilterRow>
              )}
              {filterOptions.brewingMethods.length > 0 && (
                <FilterRow label="Заваривание">
                  <FilterPill active={!activeBrewing} onClick={() => updateParams("brewing", undefined)}>Все</FilterPill>
                  {filterOptions.brewingMethods.map((method) => (
                    <FilterPill key={method} active={activeBrewing === method} onClick={() => updateParams("brewing", activeBrewing === method ? undefined : method)}>
                      {brewingLabels[method] ?? method}
                    </FilterPill>
                  ))}
                </FilterRow>
              )}
            </>
          )}

          {/* TEA sub-filters */}
          {activeType === "tea" && (
            <>
              {filterOptions.teaTypes.length > 0 && (
                <FilterRow label="Вид чая">
                  <FilterPill active={!activeTeaType} onClick={() => updateParams("teaType", undefined)}>Все</FilterPill>
                  {filterOptions.teaTypes.map((t) => (
                    <FilterPill key={t.slug} active={activeTeaType === t.slug} onClick={() => updateParams("teaType", activeTeaType === t.slug ? undefined : t.slug)}>
                      {t.name}
                    </FilterPill>
                  ))}
                </FilterRow>
              )}
              {filterOptions.origins.length > 1 && (
                <FilterRow label="Страна">
                  <FilterPill active={!activeOrigin} onClick={() => updateParams("origin", undefined)}>Все</FilterPill>
                  {filterOptions.origins.map((origin) => (
                    <FilterPill key={origin} active={activeOrigin === origin} onClick={() => updateParams("origin", activeOrigin === origin ? undefined : origin)}>
                      {origin}
                    </FilterPill>
                  ))}
                </FilterRow>
              )}
              {filterOptions.productForms.length > 0 && (
                <FilterRow label="Форма">
                  <FilterPill active={!activeForm} onClick={() => updateParams("form", undefined)}>Все</FilterPill>
                  {filterOptions.productForms.map((form) => (
                    <FilterPill key={form} active={activeForm === form} onClick={() => updateParams("form", activeForm === form ? undefined : form)}>
                      {form}
                    </FilterPill>
                  ))}
                </FilterRow>
              )}
            </>
          )}

          {/* INSTANT sub-filters */}
          {activeType === "instant" && filterOptions.productForms.length > 0 && (
            <FilterRow label="Вид">
              <FilterPill active={!activeForm} onClick={() => updateParams("form", undefined)}>Все</FilterPill>
              {filterOptions.productForms.map((form) => (
                <FilterPill key={form} active={activeForm === form} onClick={() => updateParams("form", activeForm === form ? undefined : form)}>
                  {form}
                </FilterPill>
              ))}
            </FilterRow>
          )}
        </div>
      )}
    </div>
  )
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground w-20 shrink-0">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
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
