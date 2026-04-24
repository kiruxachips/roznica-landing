import { redirect } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { getWholesaleContext } from "@/lib/wholesale-guard"
import { WholesaleSidebar } from "@/components/wholesale/Sidebar"
import { getWholesaleCatalog } from "@/lib/dal/wholesale-catalog"
import { AddToWholesaleCartButton } from "@/components/wholesale/AddToCartButton"
import { TierInfoBanner } from "@/components/wholesale/TierProgressBar"

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
        <div className="flex-1 min-w-0 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h1 className="font-serif text-xl sm:text-2xl font-bold">Оптовый каталог</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {catalog.length} товаров · цены с учётом скидки по весу корзины
              </p>
            </div>
            <Link
              href="/wholesale/cart"
              className="text-sm rounded-lg bg-primary/10 text-primary font-medium px-3 py-1.5 hover:bg-primary/15"
            >
              В корзину →
            </Link>
          </div>

          <TierInfoBanner />

          {catalog.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Каталог пуст. Свяжитесь с менеджером для настройки прайс-листа.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-border/60">
              {catalog.map((product) => (
                <article
                  key={product.id}
                  className="flex items-start sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 hover:bg-muted/30 transition-colors"
                >
                  <Link
                    href={`/wholesale/catalog/${product.slug}`}
                    className="shrink-0 w-16 h-16 sm:w-20 sm:h-20 relative rounded-lg overflow-hidden bg-secondary/30"
                  >
                    {(product.primaryImage || product.smallImage) && (
                      <Image
                        src={product.primaryImage || product.smallImage!}
                        alt={product.primaryImageAlt ?? product.name}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    )}
                    {product.badge && (
                      <div className="absolute top-0.5 left-0.5 bg-primary text-primary-foreground text-[9px] px-1 py-0.5 rounded">
                        {product.badge}
                      </div>
                    )}
                  </Link>

                  <div className="flex-1 min-w-0">
                    <Link href={`/wholesale/catalog/${product.slug}`} className="block">
                      <h3 className="font-semibold text-sm sm:text-base leading-tight truncate">
                        {product.name}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {[product.origin, product.roastLevel].filter(Boolean).join(" · ") ||
                          (product.flavorNotes.slice(0, 3).join(", ") || "—")}
                      </p>
                    </Link>
                  </div>

                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 sm:gap-2 shrink-0">
                    {product.variants.map((v) => (
                      <div
                        key={v.id}
                        className="flex items-center gap-1.5 bg-secondary/40 rounded-lg px-2 py-1.5"
                      >
                        <div className="text-right">
                          <div className="text-[10px] text-muted-foreground leading-none">
                            {v.weight}
                          </div>
                          <div className="text-sm font-semibold leading-tight">
                            {v.price.toLocaleString("ru")}₽
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
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
