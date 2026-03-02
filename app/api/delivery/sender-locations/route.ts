import { NextResponse } from "next/server"
import { getDeliverySettings, parseSenderLocations } from "@/lib/dal/delivery-settings"

export async function GET() {
  try {
    const settings = await getDeliverySettings()
    const locations = parseSenderLocations(settings.sender_locations || "[]")
    return NextResponse.json(locations)
  } catch {
    return NextResponse.json([], { status: 500 })
  }
}
