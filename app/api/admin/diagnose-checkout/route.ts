import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { calculateDeliveryRates, buildPackagePlan, type ItemToPack } from "@/lib/delivery"
import { validatePromoCode } from "@/lib/dal/promo-codes"

/**
 * Диагностический эндпоинт — прогоняет стадии создания заказа БЕЗ реального save.
 * Авторизация по заголовку x-diag-token, сверяется с MILLORBOT_SHARED_SECRET
 * (уже существующий prod-секрет на сервере). Это нужно один раз для отладки
 * падения checkout — после устранения бага endpoint можно удалить.
 *
 * POST body:
 * {
 *   variantIds: string[]
 *   quantities: number[]
 *   city?: string
 *   cityCode?: string
 *   postalCode?: string
 *   deliveryMethod: "cdek" | "pochta" | "courier"
 *   tariffCode: number
 *   cartTotal: number
 *   promoCode?: string
 *   userId?: string
 * }
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get("x-diag-token")
  const expected = process.env.MILLORBOT_SHARED_SECRET
  if (!expected || !token || token !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const steps: Array<{ step: string; ok: boolean; detail?: unknown; error?: string }> = []
  function pushOk(step: string, detail?: unknown) {
    steps.push({ step, ok: true, detail })
  }
  function pushErr(step: string, error: unknown) {
    steps.push({ step, ok: false, error: error instanceof Error ? error.message : String(error) })
  }

  try {
    const body = await req.json()
    const {
      variantIds = [] as string[],
      quantities = [] as number[],
      city,
      cityCode,
      postalCode,
      deliveryMethod,
      tariffCode,
      cartTotal,
      promoCode,
      userId,
    } = body

    // 1. Валидация variants
    const variants: Array<{ id: string; price: number; stock: number; isActive: boolean; weight: string; name: string }> = []
    try {
      for (let i = 0; i < variantIds.length; i++) {
        const v = await prisma.productVariant.findUnique({
          where: { id: variantIds[i] },
          select: {
            id: true,
            price: true,
            stock: true,
            isActive: true,
            weight: true,
            product: { select: { name: true, isActive: true } },
          },
        })
        if (!v) throw new Error(`Variant ${variantIds[i]} не найден`)
        if (!v.isActive) throw new Error(`Variant ${v.weight} неактивен`)
        if (!v.product.isActive) throw new Error(`Товар "${v.product.name}" скрыт`)
        if (v.stock < quantities[i]) throw new Error(`${v.product.name} ${v.weight}: stock=${v.stock} < ${quantities[i]}`)
        variants.push({
          id: v.id,
          price: v.price,
          stock: v.stock,
          isActive: v.isActive,
          weight: v.weight,
          name: v.product.name,
        })
      }
      pushOk("variants_validation", variants)
    } catch (e) {
      pushErr("variants_validation", e)
      return NextResponse.json({ ok: false, steps })
    }

    // 2. Промокод
    try {
      if (promoCode) {
        const result = await validatePromoCode(promoCode, cartTotal, userId)
        pushOk("promo_validation", result)
      } else {
        pushOk("promo_validation", "no promo")
      }
    } catch (e) {
      pushErr("promo_validation", e)
    }

    // 3. Build package plan
    let plan
    try {
      const items: ItemToPack[] = variants.map((v, i) => ({
        weightGrams: parseWeightGrams(v.weight),
        quantity: quantities[i],
      }))
      plan = await buildPackagePlan(items)
      pushOk("build_package_plan", plan)
    } catch (e) {
      pushErr("build_package_plan", e)
      return NextResponse.json({ ok: false, steps })
    }

    // 4. Calculate rates (server-side, как в createOrderDAL)
    let matchingRate = null
    try {
      const items: ItemToPack[] = variants.map((v, i) => ({
        weightGrams: parseWeightGrams(v.weight),
        quantity: quantities[i],
      }))
      const rates = await calculateDeliveryRates({
        toCityCode: cityCode,
        toPostalCode: postalCode,
        toCity: city,
        items,
        cartTotal,
      })
      pushOk("calculate_rates", { count: rates.length, rates })

      matchingRate = rates.find((r) => r.tariffCode === tariffCode && r.carrier === deliveryMethod)
      if (!matchingRate) {
        pushErr("find_matching_rate", `Не найден тариф ${tariffCode} для ${deliveryMethod}. Доступные: ${rates.map(r => `${r.carrier}:${r.tariffCode}`).join(", ")}`)
        return NextResponse.json({ ok: false, steps })
      }
      pushOk("find_matching_rate", matchingRate)
    } catch (e) {
      pushErr("calculate_rates", e)
      return NextResponse.json({ ok: false, steps })
    }

    // 5. YooKassa config check
    try {
      const yookassaShopId = process.env.YOOKASSA_SHOP_ID
      const yookassaSecretKey = process.env.YOOKASSA_SECRET_KEY
      pushOk("yookassa_env_check", {
        hasShopId: !!yookassaShopId,
        hasSecretKey: !!yookassaSecretKey,
        shopIdLength: yookassaShopId?.length ?? 0,
      })
    } catch (e) {
      pushErr("yookassa_env_check", e)
    }

    return NextResponse.json({ ok: true, steps })
  } catch (e) {
    pushErr("top_level", e)
    return NextResponse.json({ ok: false, steps }, { status: 500 })
  }
}

function parseWeightGrams(w: string): number {
  const lower = w.toLowerCase().trim()
  const match = lower.match(/^([\d.,]+)\s*(кг|г|kg|g)?$/)
  if (!match) return 0
  const n = parseFloat(match[1].replace(",", "."))
  if (isNaN(n)) return 0
  const unit = match[2] || "г"
  return unit === "кг" || unit === "kg" ? Math.round(n * 1000) : Math.round(n)
}
