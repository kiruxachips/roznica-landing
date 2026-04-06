import { ImageResponse } from "next/og"

export const runtime = "edge"

export const alt = "Millor Coffee — Свежеобжаренный кофе для дома"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1a4a33 0%, #2d6b4a 50%, #3d8b5e 100%)",
          fontFamily: "sans-serif",
        }}
      >
        {/* Coffee bean decorative circles */}
        <div
          style={{
            position: "absolute",
            top: 40,
            right: 60,
            width: 120,
            height: 120,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.08)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 60,
            left: 80,
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.06)",
            display: "flex",
          }}
        />

        {/* Main content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 24,
          }}
        >
          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: "#ffffff",
              letterSpacing: "-1px",
              display: "flex",
            }}
          >
            Millor Coffee
          </div>
          <div
            style={{
              width: 80,
              height: 3,
              background: "rgba(255,255,255,0.5)",
              borderRadius: 2,
              display: "flex",
            }}
          />
          <div
            style={{
              fontSize: 28,
              color: "rgba(255,255,255,0.85)",
              maxWidth: 700,
              textAlign: "center",
              lineHeight: 1.4,
              display: "flex",
            }}
          >
            Свежеобжаренный кофе в зёрнах для дома с доставкой по России
          </div>
        </div>

        {/* Bottom tagline */}
        <div
          style={{
            position: "absolute",
            bottom: 40,
            fontSize: 18,
            color: "rgba(255,255,255,0.5)",
            display: "flex",
          }}
        >
          millor-coffee.ru
        </div>
      </div>
    ),
    { ...size },
  )
}
