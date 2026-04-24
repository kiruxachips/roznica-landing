export const dynamic = "force-dynamic"

import Link from "next/link"
import Image from "next/image"
import { prisma } from "@/lib/prisma"
import { Plus } from "lucide-react"
import { ProductActions } from "./ProductActions"
import { requireAdmin } from "@/lib/admin-guard"

const PAGE_SIZE = 50

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string; q?: string }>
}) {
  await requireAdmin("products.view")
  const sp = (await searchParams) ?? {}
  const page = Math.max(1, Number(sp.page) || 1)
  const q = (sp.q ?? "").trim()

  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { slug: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {}

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { sortOrder: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        category: { select: { name: true } },
        images: { where: { isPrimary: true }, take: 1 },
        variants: {
          where: { isActive: true },
          orderBy: { price: "asc" },
          select: { id: true, price: true, stock: true, lowStockThreshold: true },
        },
        _count: { select: { reviews: true } },
      },
    }),
    prisma.product.count({ where }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function stockBadge(variants: { stock: number; lowStockThreshold: number | null }[]) {
    if (variants.length === 0) return { label: "—", cls: "bg-gray-50 text-gray-500" }
    const totalStock = variants.reduce((s, v) => s + v.stock, 0)
    const allOut = variants.every((v) => v.stock <= 0)
    const anyLow = variants.some(
      (v) => v.stock > 0 && v.lowStockThreshold !== null && v.stock <= v.lowStockThreshold
    )
    if (allOut) return { label: `${totalStock} · нет в наличии`, cls: "bg-red-50 text-red-700" }
    if (anyLow) return { label: `${totalStock} · низкий`, cls: "bg-amber-50 text-amber-700" }
    return { label: `${totalStock}`, cls: "bg-green-50 text-green-700" }
  }

  function pageHref(p: number) {
    const params = new URLSearchParams()
    if (p > 1) params.set("page", String(p))
    if (q) params.set("q", q)
    const s = params.toString()
    return s ? `/admin/products?${s}` : "/admin/products"
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Товары</h1>
        <Link
          href="/admin/products/new"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Добавить товар
        </Link>
      </div>

      <form method="get" className="mb-4">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Поиск по названию или slug..."
          className="w-full max-w-md px-3 py-2 border border-border rounded-lg text-sm"
        />
      </form>

      <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Товар</th>
              <th className="text-left px-4 py-3 font-medium">Категория</th>
              <th className="text-left px-4 py-3 font-medium">Цена</th>
              <th className="text-left px-4 py-3 font-medium">Остаток</th>
              <th className="text-left px-4 py-3 font-medium">Отзывы</th>
              <th className="text-left px-4 py-3 font-medium">Статус</th>
              <th className="w-24 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="border-t border-border hover:bg-muted/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {product.images[0] ? (
                      <Image
                        src={product.images[0].url}
                        alt={product.name}
                        width={40}
                        height={40}
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-muted" />
                    )}
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.slug}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{product.category.name}</td>
                <td className="px-4 py-3">
                  {product.variants[0] ? `от ${product.variants[0].price}₽` : "—"}
                </td>
                <td className="px-4 py-3">
                  {(() => {
                    const badge = stockBadge(product.variants)
                    return (
                      <span className={`px-2 py-1 rounded-md text-xs font-medium ${badge.cls}`}>
                        {badge.label}
                      </span>
                    )
                  })()}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{product._count.reviews}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <span className={`px-2 py-1 rounded-md text-xs font-medium w-fit ${product.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {product.isActive ? "Активен" : "Скрыт"}
                    </span>
                    {product.productType !== "coffee" && (
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium w-fit ${
                        product.productType === "tea" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"
                      }`}>
                        {product.productType === "tea" ? "Чай" : "Растворимая"}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <ProductActions productId={product.id} productName={product.name} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {products.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">Нет товаров</div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <p className="text-muted-foreground">
            Всего: <span className="font-medium text-foreground">{total}</span> · Стр. {page} из {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={pageHref(page - 1)}
                className="px-3 py-1.5 border border-border rounded-lg hover:bg-muted transition-colors"
              >
                ← Предыдущая
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={pageHref(page + 1)}
                className="px-3 py-1.5 border border-border rounded-lg hover:bg-muted transition-colors"
              >
                Следующая →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
