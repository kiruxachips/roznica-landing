import Image from "next/image"
import Link from "next/link"
import { Star, MapPin, Flame, Package } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getFeaturedProducts } from "@/lib/dal/products"
import { FeaturedBuyButton } from "./FeaturedBuyButton"

interface FeaturedProduct {
  id: string
  name: string
  slug: string
  description: string
  origin: string | null
  roastLevel: string | null
  badge: string | null
  primaryImage: string | null
  primaryImageAlt: string | null
  minPrice: number | null
  minOldPrice: number | null
  reviewCount: number
  averageRating: number | null
  firstVariant: { id: string; weight: string; price: number; stock: number } | null
}

// Static fallback data (used if DB is not available)
const staticProducts: FeaturedProduct[] = [
  {
    id: "1",
    name: "Peru GR1",
    slug: "peru-gr1",
    description: "Яркий вкус с нотами шоколада, карамели и лёгкой цитрусовой кислинкой",
    origin: "Перу",
    roastLevel: "Средняя",
    badge: "Хит продаж",
    primaryImage: "/images/peru.webp",
    primaryImageAlt: "Peru GR1",
    minPrice: 2000,
    minOldPrice: 2200,
    reviewCount: 24,
    averageRating: 5,
    firstVariant: null,
  },
  {
    id: "2",
    name: "Brazil Yellow Bourbon",
    slug: "brazil-yellow-bourbon",
    description: "Сладкий вкус с нотами молочного шоколада, орехов и карамели",
    origin: "Бразилия",
    roastLevel: "Средняя",
    badge: "Премиум",
    primaryImage: "/images/bourbon.webp",
    primaryImageAlt: "Brazil Yellow Bourbon",
    minPrice: 2000,
    minOldPrice: 2200,
    reviewCount: 31,
    averageRating: 5,
    firstVariant: null,
  },
  {
    id: "3",
    name: "Brazil Santos",
    slug: "brazil-santos",
    description: "Мягкий сбалансированный вкус с нотами какао и лёгкой ореховой сладостью",
    origin: "Бразилия",
    roastLevel: "Средняя",
    badge: "Классика",
    primaryImage: "/images/santos.webp",
    primaryImageAlt: "Brazil Santos",
    minPrice: 1900,
    minOldPrice: 2000,
    reviewCount: 18,
    averageRating: 5,
    firstVariant: null,
  },
]

async function getProducts(): Promise<FeaturedProduct[]> {
  try {
    return await getFeaturedProducts(3)
  } catch {
    return staticProducts
  }
}

export async function Products() {
  const products = await getProducts()

  return (
    <section id="products" className="py-20 sm:py-28 bg-secondary/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Хиты продаж
          </h2>
          <p className="text-muted-foreground text-lg">
            Самые популярные сорта для дома. Выгодная фасовка 1 кг
          </p>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {products.map((product) => (
            <div key={product.id}>
              <Link href={`/catalog/${product.slug}`}>
                <Card className="group overflow-hidden bg-white border-0 shadow-md hover:shadow-xl transition-all duration-300">
                  {/* Product Image */}
                  <div className="relative aspect-[2/3] bg-neutral-100 overflow-hidden rounded-t-xl">
                    {product.primaryImage && (
                      <Image
                        src={product.primaryImage}
                        alt={product.primaryImageAlt ?? product.name}
                        fill
                        className="object-cover object-top group-hover:scale-105 transition-transform duration-500"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    )}
                    {product.badge && (
                      <Badge className="absolute top-4 left-4 z-10 font-bold text-sm px-3 py-1 bg-white text-black border-0">
                        {product.badge}
                      </Badge>
                    )}
                  </div>

                  <CardContent className="p-3">
                    {/* Rating */}
                    {product.averageRating && (
                      <div className="flex items-center gap-1 mb-1">
                        {Array.from({ length: Math.round(product.averageRating) }).map((_, i) => (
                          <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                        ))}
                        <span className="text-xs text-muted-foreground ml-1">
                          ({product.reviewCount})
                        </span>
                      </div>
                    )}

                    {/* Title */}
                    <h3 className="font-semibold text-base text-foreground mb-1 group-hover:text-primary transition-colors">
                      {product.name}
                    </h3>

                    {/* Description */}
                    <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                      {product.description}
                    </p>

                    {/* Meta */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {product.origin && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {product.origin}
                        </span>
                      )}
                      {product.roastLevel && (
                        <span className="flex items-center gap-1">
                          <Flame className="w-3 h-3" />
                          {product.roastLevel}
                        </span>
                      )}
                      {product.firstVariant && (
                        <span className="flex items-center gap-1">
                          <Package className="w-3 h-3" />
                          {product.firstVariant.weight}
                        </span>
                      )}
                    </div>
                  </CardContent>

                  <CardFooter className="p-3 pt-0 flex items-center justify-between">
                    {/* Price */}
                    <div className="flex items-baseline gap-2">
                      {product.minPrice && (
                        <span className="text-xl font-bold text-primary">
                          {product.minPrice}₽
                        </span>
                      )}
                      {product.minOldPrice && product.minOldPrice > (product.minPrice ?? 0) && (
                        <span className="text-sm text-muted-foreground line-through">
                          {product.minOldPrice}₽
                        </span>
                      )}
                    </div>

                    {product.firstVariant ? (
                      <FeaturedBuyButton
                        productId={product.id}
                        variantId={product.firstVariant.id}
                        name={product.name}
                        weight={product.firstVariant.weight}
                        price={product.firstVariant.price}
                        image={product.primaryImage}
                        slug={product.slug}
                        stock={product.firstVariant.stock}
                      />
                    ) : (
                      <span className={cn(buttonVariants({ size: "sm" }), "pointer-events-none")}>
                        Купить
                      </span>
                    )}
                  </CardFooter>
                </Card>
              </Link>
            </div>
          ))}
        </div>

        {/* View All Button */}
        <div className="text-center mt-12">
          <Link
            href="/catalog"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "inline-flex items-center gap-2")}
          >
            Смотреть весь каталог
          </Link>
        </div>
      </div>
    </section>
  )
}
