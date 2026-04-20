import { NextRequest, NextResponse } from "next/server"
import { searchCities } from "@/lib/delivery/city-search"

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")
  if (!q || q.length < 2) {
    return NextResponse.json([])
  }

  try {
    const cities = await searchCities(q)
    return NextResponse.json(cities, {
      headers: { "Cache-Control": "public, max-age=300, s-maxage=1800, stale-while-revalidate=3600" },
    })
  } catch {
    return NextResponse.json([], { status: 500 })
  }
}
