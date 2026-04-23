import { ImageResponse } from "next/og"
import { getArticleBySlug } from "@/lib/dal/articles"

export const runtime = "nodejs"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const alt = "Millor Coffee — блог"

export default async function BlogOgImage({ params }: { params: { slug: string } }) {
  const article = await getArticleBySlug(params.slug)

  const title = article?.title ?? "Блог Millor Coffee"
  const excerpt = article?.excerpt ?? ""
  const category = article?.category?.name ?? ""

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
          background: "linear-gradient(135deg, #2d6b4a 0%, #1a4d33 100%)",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "#fff",
              color: "#2d6b4a",
              fontSize: 28,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            M
          </div>
          <span style={{ fontSize: 32, fontWeight: 600 }}>Millor Coffee</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {category && (
            <span
              style={{
                fontSize: 24,
                color: "#c4e0d1",
                marginBottom: 16,
                textTransform: "uppercase",
                letterSpacing: 2,
              }}
            >
              {category}
            </span>
          )}
          <span
            style={{
              fontSize: 64,
              fontWeight: 700,
              lineHeight: 1.15,
              marginBottom: excerpt ? 24 : 0,
            }}
          >
            {title.length > 80 ? title.slice(0, 77) + "…" : title}
          </span>
          {excerpt && (
            <span
              style={{
                fontSize: 26,
                color: "#d4e8dd",
                lineHeight: 1.4,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {excerpt}
            </span>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <span style={{ fontSize: 24, color: "#b8d6c6" }}>millor-coffee.ru/blog</span>
        </div>
      </div>
    ),
    size
  )
}
