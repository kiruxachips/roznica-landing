"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { Search, SlidersHorizontal, X } from "lucide-react"
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
  activeSearch?: string
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
  activeSearch,
}: FilterBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Search state with debounce
  const [searchValue, setSearchValue] = useState(activeSearch ?? "")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [])

  // Sync if external navigation resets the query
  useEffect(() => {
    setSearchValue(activeSearch ?? "")
  }, [activeSearch])

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchValue(value)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        const params = new URLSearchParams(searchParams.toString())
        if (value.trim()) {
          params.set("q", value.trim())
        } else {
          params.delete("q")
        }
        params.delete("page")
        router.push(`/catalog?${params.toString()}`)
      }, 400)
    },
    [router, searchParams]
  )

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
      // When switching tabs, drop all sub-filters, keep sort + search
      const params = new URLSearchParams()
      params.set("type", type)
      if (activeSort) params.set("sort", activeSort)
      if (searchValue.trim()) params.set("q", searchValue.trim())
      router.push(`/catalog?${params.toString()}`)
    },
    [router, activeSort, searchValue]
  )

  const hasSubFilters = !!(activeRoast || activeOrigin || activeBrewing || activeTeaType || activeForm)

  const clearSubFilters = useCallback(() => {
    const params = new URLSearchParams()
    if (activeType) params.set("type", activeType)
    if (activeSort) params.set("sort", activeSort)
    if (searchValue.trim()) params.set("q", searchValue.trim())
    router.push(`/catalog?${params.toString()}`)
  }, [router, activeType, activeSort, searchValue])

  const [filtersOpen, setFiltersOpen] = useState(!!hasSubFilters)

  return (
    <div className="sticky top-16 z-30 bg-white/95 backdrop-blur-sm border-b border-border -mx-4 px-4 sm:-mx-6 sm:px-6 mb-4 py-2">
      <div className="flex flex-col md:flex-row md:items-center gap-2">
        {/* Product-type tabs */}
        <div className="flex items-center gap-1 shrink-0 overflow-x-auto scrollbar-hide">
          {TYPE_TABS.map((tab) => {
            const isActive = activeType === tab.value || (!activeType && tab.value === "coffee")
            return (
              <button
                key={tab.value}
                onClick={() => switchType(tab.value as ProductType)}
                className={cn(
                  "shrink-0 px-4 h-9 rounded-full text-sm font-semibold transition-all",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Search + filter toggle + sort — shares a row with tabs on md+ */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="search"
              value={searchValue}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Поиск…"
              className="w-full h-9 pl-9 pr-8 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {searchValue && (
              <button
                onClick={() => handleSearchChange("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={cn(
              "relative shrink-0 h-9 w-9 rounded-lg border border-input flex items-center justify-center transition-colors",
              filtersOpen ? "bg-primary/10 text-primary border-primary/30" : "bg-background text-muted-foreground hover:text-foreground"
            )}
            title="Фильтры"
            aria-label="Фильтры"
          >
            <SlidersHorizontal className="w-4 h-4" />
            {hasSubFilters && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" />}
          </button>

          <select
            value={activeSort ?? ""}
            onChange={(e) => updateParams("sort", e.target.value || undefined)}
            className="shrink-0 h-9 px-2.5 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
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
