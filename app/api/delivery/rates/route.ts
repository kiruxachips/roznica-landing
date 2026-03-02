import { NextRequest, NextResponse } from "next/server"
import { calculateDeliveryRates } from "@/lib/delivery"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { cityCode, postalCode, weight, cartTotal } = body

    const rates = await calculateDeliveryRates({
      toCityCode: cityCode,
      toPostalCode: postalCode,
      cartWeight: weight,
      cartTotal,
    })

    return NextResponse.json(rates)
  } catch {
    return NextResponse.json({ error: "Failed to calculate rates" }, { status: 500 })
  }
}
