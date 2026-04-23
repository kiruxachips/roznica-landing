import { ImageResponse } from "next/og"
import { getProductBySlug } from "@/lib/dal/products"

// R4: динамически сгенерированная OG-картинка для товара.
// Next.js кэширует результат по пути + slug, пересобирается при invalidate-tag.
export const runtime = "nodejs"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const alt = "Millor Coffee — свежеобжаренный кофе"

export default async function CatalogOgImage({ params }: { params: { slug: string } }) {
  const product = await getProductBySlug(params.slug)

  const name = product?.name ?? "Millor Coffee"
  const origin = product?.origin ?? ""
  const roast = product?.roastLevel ?? ""
  const price =
    product && product.variants.length > 0
      ? `от ${Math.min(...product.variants.map((v) => v.price))}₽`
      : ""

  const meta = [origin, roast].filter(Boolean).join(" · ")

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px 64px",
          background: "linear-gradient(135deg, #f5f0eb 0%, #e8ddd0 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "#7c4a1e",
              color: "#fff",
              fontSize: 28,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            M
          </div>
          <span style={{ fontSize: 32, fontWeight: 600, color: "#3d2412" }}>Millor Coffee</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {meta && (
            <span
              style={{
                fontSize: 28,
                color: "#7c4a1e",
                marginBottom: 16,
                textTransform: "uppercase",
                letterSpacing: 2,
              }}
            >
              {meta}
            </span>
          )}
          <span
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: "#1e1a14",
              lineHeight: 1.1,
            }}
          >
            {name}
          </span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          {price && (
            <span style={{ fontSize: 56, fontWeight: 700, color: "#7c4a1e" }}>{price}</span>
          )}
          <span style={{ fontSize: 24, color: "#6d5a45" }}>millor-coffee.ru</span>
        </div>
      </div>
    ),
    size
  )
}
