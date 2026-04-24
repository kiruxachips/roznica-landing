import { NextRequest, NextResponse } from "next/server"
import { suggestParty } from "@/lib/integrations/dadata"
import { checkRateLimit } from "@/lib/rate-limit"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") || ""
  if (query.length < 3) return NextResponse.json({ suggestions: [] })

  // Защита от брутфорса API-квоты DaData
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  const rl = checkRateLimit(`dadata:${ip}`, {
    windowMs: 60 * 1000,
    max: 30,
    blockMs: 5 * 60 * 1000,
  })
  if (!rl.allowed) return NextResponse.json({ suggestions: [] }, { status: 429 })

  const suggestions = await suggestParty(query)
  // Возвращаем только безопасные поля (никаких state-flags, просто для автозаполнения)
  return NextResponse.json({
    suggestions: suggestions.map((s) => ({
      value: s.value,
      inn: s.data.inn,
      kpp: s.data.kpp,
      ogrn: s.data.ogrn,
      address: s.data.address?.value,
      status: s.data.state?.status,
    })),
  })
}
