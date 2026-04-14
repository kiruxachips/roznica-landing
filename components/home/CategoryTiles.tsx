import Link from "next/link"
import Image from "next/image"

interface Tile {
  iconSrc: string
  label: string
  brewing: string
}

const tiles: Tile[] = [
  { iconSrc: "/images/brewing/ecspresso.svg", label: "Для эспрессо", brewing: "espresso" },
  { iconSrc: "/images/brewing/voronka.svg", label: "Для фильтра", brewing: "filter" },
  { iconSrc: "/images/brewing/tyrka.svg", label: "Для турки", brewing: "turka" },
  { iconSrc: "/images/brewing/french.svg", label: "Френч-пресс", brewing: "french-press" },
  { iconSrc: "/images/brewing/moka.svg", label: "Мока", brewing: "moka" },
  { iconSrc: "/images/brewing/aero.svg", label: "Аэропресс", brewing: "aeropress" },
]

export function CategoryTiles() {
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

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 sm:gap-4 max-w-4xl mx-auto">
          {tiles.map((tile) => (
            <Link
              key={tile.brewing}
              href={`/catalog?brewing=${tile.brewing}`}
              className="group flex flex-col items-center gap-2 p-3 sm:p-5 rounded-xl sm:rounded-2xl bg-white border border-border/50 hover:bg-foreground hover:border-foreground transition-all duration-200"
            >
              <Image
                src={tile.iconSrc}
                alt={tile.label}
                width={64}
                height={64}
                className="w-10 h-10 sm:w-14 sm:h-14 opacity-70 group-hover:opacity-100 group-hover:invert transition-all"
              />
              <span className="text-[11px] sm:text-sm font-medium text-muted-foreground group-hover:text-white transition-colors text-center leading-tight">
                {tile.label}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
