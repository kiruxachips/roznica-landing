import { NextResponse } from "next/server"
import { getDeliverySettings, parseSenderLocations } from "@/lib/dal/delivery-settings"

export async function GET() {
  try {
    const settings = await getDeliverySettings()
    const locations = parseSenderLocations(settings.sender_locations || "[]")
    return NextResponse.json(locations, {
      headers: { "Cache-Control": "public, max-age=600, s-maxage=3600" },
    })
  } catch {
    return NextResponse.json([], { status: 500 })
  }
}
