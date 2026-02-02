import Image from "next/image"
import { Star, ExternalLink, MapPin, Flame, Package } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { TrackedLink } from "@/components/ui/tracked-link"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { products, CATALOG_URL } from "@/lib/constants"

export function Products() {
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
            <Card
              key={product.id}
              className="group overflow-hidden bg-white border-0 shadow-md hover:shadow-xl transition-all duration-300"
            >
              {/* Product Image */}
              <div className="relative aspect-[2/3] bg-neutral-100 overflow-hidden rounded-t-xl">
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  className="object-cover object-top group-hover:scale-105 transition-transform duration-500"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
                {/* Badge */}
                {product.badge && (
                  <Badge className="absolute top-4 left-4 z-10 font-bold text-sm px-3 py-1 bg-white text-black border-0">
                    {product.badge}
                  </Badge>
                )}
                {/* Quick view overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
                  <TrackedLink
                    href={product.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
                  >
                    Подробнее
                  </TrackedLink>
                </div>
              </div>

              <CardContent className="p-3">
                {/* Rating */}
                <div className="flex items-center gap-1 mb-1">
                  {Array.from({ length: product.rating }).map((_, i) => (
                    <Star
                      key={i}
                      className="w-3 h-3 fill-amber-400 text-amber-400"
                    />
                  ))}
                  <span className="text-xs text-muted-foreground ml-1">
                    ({product.reviews})
                  </span>
                </div>

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
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {product.origin}
                  </span>
                  <span className="flex items-center gap-1">
                    <Flame className="w-3 h-3" />
                    {product.roast}
                  </span>
                  <span className="flex items-center gap-1">
                    <Package className="w-3 h-3" />
                    {product.weight}
                  </span>
                </div>
              </CardContent>

              <CardFooter className="p-3 pt-0 flex items-center justify-between">
                {/* Price */}
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold text-primary">
                    {product.price}₽
                  </span>
                  <span className="text-sm text-muted-foreground line-through">
                    {product.oldPrice}₽
                  </span>
                </div>

                {/* Buy Button */}
                <TrackedLink
                  href={product.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonVariants({ size: "sm" }), "flex items-center gap-1")}
                >
                  Купить
                  <ExternalLink className="w-3 h-3" />
                </TrackedLink>
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* View All Button */}
        <div className="text-center mt-12">
          <TrackedLink
            href={CATALOG_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "inline-flex items-center gap-2")}
          >
            Смотреть весь каталог
            <ExternalLink className="w-4 h-4" />
          </TrackedLink>
        </div>
      </div>
    </section>
  )
}
