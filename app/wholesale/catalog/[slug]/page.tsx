import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { getWholesaleContext } from "@/lib/wholesale-guard"
import { WholesaleSidebar } from "@/components/wholesale/Sidebar"
import { getWholesaleProductBySlug } from "@/lib/dal/wholesale-catalog"
import { AddToWholesaleCartButton } from "@/components/wholesale/AddToCartButton"

export const dynamic = "force-dynamic"

export default async function WholesaleProductPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const ctx = await getWholesaleContext()
  if (!ctx) redirect("/wholesale/login")

  const product = await getWholesaleProductBySlug(slug, {
    channel: "wholesale",
    priceListId: ctx.company.priceListId,
    companyId: ctx.companyId,
  })

  if (!product) notFound()

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col lg:flex-row gap-5 lg:gap-8">
        <WholesaleSidebar />
        <div className="flex-1 min-w-0">
          <Link href="/wholesale/catalog" className="text-sm text-muted-foreground hover:text-foreground">
            ← Каталог
          </Link>

          <div className="mt-4 grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="aspect-square relative bg-secondary/30">
                {(product.primaryImage || product.smallImage) && (
                  <Image
                    src={product.primaryImage || product.smallImage!}
                    alt={product.primaryImageAlt ?? product.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover"
                  />
                )}
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <h1 className="font-serif text-2xl sm:text-3xl font-bold">{product.name}</h1>
                {product.origin && (
                  <p className="text-muted-foreground mt-1">{product.origin}</p>
                )}
              </div>

              {product.flavorNotes.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {product.flavorNotes.map((note) => (
                    <span
                      key={note}
                      className="inline-flex px-3 py-1 rounded-full bg-secondary text-xs"
                    >
                      {note}
                    </span>
                  ))}
                </div>
              )}

              <p className="text-sm">{product.description}</p>

              <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
                <h2 className="font-semibold">Опт — выбор фасовки</h2>
                {product.variants.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl bg-secondary/30"
                  >
                    <div>
                      <div className="font-medium">{v.weight}</div>
                      <div className="text-sm">
                        <span className="font-bold">{v.price.toLocaleString("ru")}₽</span>
                        {v.oldPrice && (
                          <span className="ml-2 text-xs line-through text-muted-foreground">
                            {v.oldPrice.toLocaleString("ru")}₽
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Минимум: {v.minQuantity} шт · На складе: {v.stock}
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

              {product.fullDescription && (
                <div className="bg-white rounded-2xl shadow-sm p-5">
                  <h2 className="font-semibold mb-2">Подробнее</h2>
                  <p className="text-sm whitespace-pre-line">{product.fullDescription}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
