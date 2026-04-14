import Link from "next/link"
import Image from "next/image"
import { LayoutGrid } from "lucide-react"
import { getBrewingCounts } from "@/lib/dal/brewing-counts"

interface Tile {
  iconSrc: string
  label: string
  brewing: string
}

const tiles: Tile[] = [
  { iconSrc: "/images/brewing/ecspresso.svg", label: "Эспрессо", brewing: "espresso" },
  { iconSrc: "/images/brewing/voronka.svg", label: "Фильтр", brewing: "filter" },
  { iconSrc: "/images/brewing/tyrka.svg", label: "Турка", brewing: "turka" },
  { iconSrc: "/images/brewing/french.svg", label: "Френч-пресс", brewing: "french-press" },
  { iconSrc: "/images/brewing/moka.svg", label: "Мока", brewing: "moka" },
  { iconSrc: "/images/brewing/aero.svg", label: "Аэропресс", brewing: "aeropress" },
]

export async function CategoryTiles() {
  const counts = await getBrewingCounts()
  const visibleTiles = tiles.filter((t) => (counts[t.brewing] ?? 0) > 0)

  // If almost nothing is configured, hide entire section — avoids misleading empty clicks.
  if (visibleTiles.length === 0) return null

  return (
    <section aria-label="Категории по способу заваривания" className="py-12 sm:py-16 lg:py-20 bg-secondary/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-12">
          <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-3">
            Подберите кофе под ваш способ
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            Для каждого способа заваривания — свои сорта. Выберите и откройте подборку.
          </p>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4 max-w-5xl mx-auto">
          {visibleTiles.map((tile) => (
            <Link
              key={tile.brewing}
              href={`/catalog?brewing=${tile.brewing}`}
              className="group flex flex-col items-center gap-2 p-3 sm:p-5 rounded-xl sm:rounded-2xl bg-white border border-border/50 hover:border-primary hover:bg-primary/5 hover:shadow-sm transition-all duration-200"
            >
              <Image
                src={tile.iconSrc}
                alt={tile.label}
                width={64}
                height={64}
                className="w-10 h-10 sm:w-14 sm:h-14 opacity-70 group-hover:opacity-100 transition-opacity"
              />
              <span className="text-[11px] sm:text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors text-center leading-tight">
                {tile.label}
                <span className="block text-[10px] sm:text-[11px] text-muted-foreground/70 mt-0.5 font-normal">
                  {counts[tile.brewing]} {counts[tile.brewing] === 1 ? "сорт" : (counts[tile.brewing] ?? 0) < 5 ? "сорта" : "сортов"}
                </span>
              </span>
            </Link>
          ))}

          {/* Catch-all tile */}
          <Link
            href="/catalog"
            className="group flex flex-col items-center gap-2 p-3 sm:p-5 rounded-xl sm:rounded-2xl border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all duration-200"
          >
            <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl bg-primary/10 flex items-center justify-center">
              <LayoutGrid className="w-5 h-5 sm:w-7 sm:h-7 text-primary" strokeWidth={1.75} />
            </div>
            <span className="text-[11px] sm:text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors text-center leading-tight">
              Все сорта
              <span className="block text-[10px] sm:text-[11px] text-muted-foreground/70 mt-0.5 font-normal">
                весь каталог
              </span>
            </span>
          </Link>
        </div>
      </div>
    </section>
  )
}
