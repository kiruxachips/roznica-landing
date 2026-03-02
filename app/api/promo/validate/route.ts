import { NextResponse } from "next/server"
import { validatePromoCode } from "@/lib/dal/promo-codes"

export async function POST(request: Request) {
  try {
    const { code, subtotal } = await request.json()

    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Введите промокод" }, { status: 400 })
    }

    if (!subtotal || typeof subtotal !== "number" || subtotal <= 0) {
      return NextResponse.json({ error: "Некорректная сумма заказа" }, { status: 400 })
    }

    const result = await validatePromoCode(code, subtotal)

    if (!result.valid) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      code: result.promo!.code,
      type: result.promo!.type,
      value: result.promo!.value,
      discount: result.discount,
    })
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 })
  }
}
