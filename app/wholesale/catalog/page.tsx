import { redirect } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { getWholesaleContext } from "@/lib/wholesale-guard"
import { WholesaleSidebar } from "@/components/wholesale/Sidebar"
import { getWholesaleCatalog } from "@/lib/dal/wholesale-catalog"
import { AddToWholesaleCartButton } from "@/components/wholesale/AddToCartButton"

export const dynamic = "force-dynamic"

export default async function WholesaleCatalogPage() {
  const ctx = await getWholesaleContext()
  if (!ctx) redirect("/wholesale/login")

  const catalog = await getWholesaleCatalog({
    channel: "wholesale",
    priceListId: ctx.company.priceListId,
    companyId: ctx.companyId,
  })

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col lg:flex-row gap-5 lg:gap-8">
        <WholesaleSidebar />
        <div className="flex-1 min-w-0 space-y-5">
          <div className="flex items-center justify-between">
            <h1 className="font-serif text-2xl sm:text-3xl font-bold">Оптовый каталог</h1>
            <Link href="/wholesale/cart" className="text-sm text-primary hover:underline">
              Перейти в корзину →
            </Link>
          </div>

          {catalog.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
              <p className="text-muted-foreground">
                Каталог пуст. Свяжитесь с менеджером для настройки прайс-листа.
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {catalog.map((product) => (
                <div
                  key={product.id}
                  className="bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col"
                >
                  <Link href={`/wholesale/catalog/${product.slug}`} className="block">
                    <div className="aspect-square relative bg-secondary/30">
                      {(product.primaryImage || product.smallImage) && (
                        <Image
                          src={product.primaryImage || product.smallImage!}
                          alt={product.primaryImageAlt ?? product.name}
                          fill
                          sizes="(max-width: 640px) 50vw, 33vw"
                          className="object-cover"
                        />
                      )}
                      {product.badge && (
                        <div className="absolute top-3 left-3 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full">
                          {product.badge}
                        </div>
                      )}
                    </div>
                  </Link>
                  <div className="p-4 flex-1 flex flex-col">
                    <Link href={`/wholesale/catalog/${product.slug}`}>
                      <h3 className="font-semibold text-sm line-clamp-1">{product.name}</h3>
                      {product.origin && (
                        <p className="text-xs text-muted-foreground mt-1">{product.origin}</p>
                      )}
                    </Link>
                    <div className="mt-3 space-y-2 flex-1">
                      {product.variants.map((v) => (
                        <div
                          key={v.id}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <div className="min-w-0">
                            <div className="font-medium">{v.weight}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-2">
                              <span>{v.price.toLocaleString("ru")}₽</span>
                              {v.oldPrice && (
                                <span className="line-through text-muted-foreground/70">
                                  {v.oldPrice.toLocaleString("ru")}₽
                                </span>
                              )}
                              {v.minQuantity > 1 && <span>· мин. {v.minQuantity}</span>}
                            </div>
                          </div>
                          <AddToWholesaleCartButton
                            productId={product.id}
                            variantId={v.id}
                            name={product.name}
                            weight={v.weight}
                            slug={product.slug}
                            image={product.primaryImage ?? product.smallImage ?? null}
                            unitPrice={v.price}
                            unitOldPrice={v.oldPrice}
                            minQuantity={v.minQuantity}
                            stock={v.stock}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
