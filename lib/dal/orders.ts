import crypto from "crypto"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import type { OrderData } from "@/lib/types"
import { validatePromoCode } from "@/lib/dal/promo-codes"
import { deductBonusesInTx, reverseOrderEarnedBonuses } from "@/lib/dal/bonuses"
import { refundGiftStock, areGiftsEnabled } from "@/lib/dal/gifts"
import {
  getWelcomeDiscountConfig,
  isEligibleForWelcomeDiscount,
  computeWelcomeDiscount,
} from "@/lib/dal/welcome-discount"
import {
  getReferralConfig,
  findActiveReferralCode,
  applyReferralReward,
} from "@/lib/dal/referral"
import { calculateDeliveryRates, buildPackagePlan, type ItemToPack } from "@/lib/delivery"
import { adjustStock, type StockAdjustResult } from "@/lib/dal/stock"
import { notifyStockChanges } from "@/lib/integrations/stock-alerts"

function parseItemWeightGrams(w: string): number {
  const lower = w.toLowerCase().trim()
  const match = lower.match(/^([\d.,]+)\s*(кг|г|kg|g)?$/)
  if (!match) return 0
  const n = parseFloat(match[1].replace(",", "."))
  if (isNaN(n)) return 0
  const unit = match[2] || "г"
  return unit === "кг" || unit === "kg" ? Math.round(n * 1000) : Math.round(n)
}

function generateOrderNumber(): string {
  const date = new Date()
  const datePart = date.toISOString().slice(2, 10).replace(/-/g, "")
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `MC-${datePart}-${randomPart}`
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex")
}

export interface UnavailableItemDetail {
  variantId: string
  productId: string
  name: string
  requested: number
  available: number
  reason: "out_of_stock" | "insufficient_stock" | "inactive" | "price_changed"
  /** Для reason="price_changed" — актуальная цена с бэка; клиент может
   * предложить юзеру "Обновить цену" вместо полного удаления позиции. */
  currentPrice?: number
}

/**
 * Выбрасывается при попытке оформить заказ с товарами, которых больше нет
 * в наличии (либо изменилась цена). Клиент на checkout ловит это и
 * показывает модалку "Убрать из корзины и продолжить" вместо generic-ошибки.
 */
export class UnavailableItemsError extends Error {
  constructor(public items: UnavailableItemDetail[]) {
    super("Some items are unavailable")
    this.name = "UnavailableItemsError"
  }
}

/**
 * Выбрасывается, если клиент видел цену доставки X, а серверный пересчёт
 * вернул Y > X. Списать с пользователя сумму больше отображённой нельзя
 * никогда (юридически и репутационно), поэтому останавливаем оформление
 * и просим обновить страницу — фронт перерисует с актуальной ценой.
 *
 * Обратный случай (сервер посчитал ДЕШЕВЛЕ) не ошибка — принимаем
 * серверную цену молча, клиенту в плюс.
 */
export class DeliveryPriceMismatchError extends Error {
  constructor(
    public clientPrice: number,
    public serverPrice: number
  ) {
    super(
      `Цена доставки изменилась: было ${clientPrice}₽, стало ${serverPrice}₽. Обновите страницу`
    )
    this.name = "DeliveryPriceMismatchError"
  }
}

/**
 * Pass-2-B: широкий total-guard. Ловит любой источник рассинхрона
 * (не только delivery): welcome, promo, gift-stock, bonus в будущем.
 * Зеркало DeliveryPriceMismatchError для полной суммы.
 */
export class TotalMismatchError extends Error {
  constructor(
    public clientTotal: number,
    public serverTotal: number
  ) {
    super(
      `Сумма заказа изменилась: было ${clientTotal}₽, стало ${serverTotal}₽. Обновите страницу`
    )
    this.name = "TotalMismatchError"
  }
}

export async function createOrder(data: OrderData) {
  const channel: "retail" | "wholesale" = data.channel === "wholesale" ? "wholesale" : "retail"
  const isWholesale = channel === "wholesale"

  // Для wholesale валидация цен делается вызывающим кодом (через resolvePrice),
  // а в orders.ts мы принимаем финальные price в items и только сверяем stock + isActive.
  // Для retail — как раньше, сверяем с variant.price.
  const unavailable: UnavailableItemDetail[] = []
  for (const item of data.items) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: item.variantId },
      select: { price: true, stock: true, isActive: true, product: { select: { name: true } } },
    })
    if (!variant || !variant.isActive) {
      unavailable.push({
        variantId: item.variantId,
        productId: item.productId,
        name: item.name,
        requested: item.quantity,
        available: 0,
        reason: "inactive",
      })
      continue
    }
    if (!isWholesale && variant.price !== item.price) {
      unavailable.push({
        variantId: item.variantId,
        productId: item.productId,
        name: item.name,
        requested: item.quantity,
        available: variant.stock,
        reason: "price_changed",
        currentPrice: variant.price,
      })
      continue
    }
    if (variant.stock < item.quantity) {
      unavailable.push({
        variantId: item.variantId,
        productId: item.productId,
        name: item.name,
        requested: item.quantity,
        available: variant.stock,
        reason: variant.stock === 0 ? "out_of_stock" : "insufficient_stock",
      })
    }
  }
  if (unavailable.length > 0) {
    throw new UnavailableItemsError(unavailable)
  }

  const subtotal = data.items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  let discount = 0
  let promoCodeId: string | null = null

  // Promo: только для retail (B2B использует собственное ценообразование через прайс-листы).
  // Если в будущем появятся B2B-промо, гейт PromoCode.channel разрешит их — но в MVP не трогаем.
  if (!isWholesale && data.promoCode) {
    const result = await validatePromoCode(data.promoCode, subtotal, data.userId)
    if (result.valid && result.promo && result.discount) {
      discount = result.discount
      promoCodeId = result.promo.id
    }
  }

  // G1-1: welcome-скидка применяется ТОЛЬКО если юзер не использовал промокод
  // (иначе стек скидок перекрывает маржу). Это осознанное решение —
  // сфокусированная конверсия новичка, а не stacking.
  // Для guest (userId=null) welcome-скидка тоже даётся — им повод зарегистрироваться.
  let welcomeDiscount = 0
  let welcomeApplied = false
  if (!isWholesale && discount === 0) {
    const eligible = await isEligibleForWelcomeDiscount(data.userId)
    if (eligible) {
      const cfg = await getWelcomeDiscountConfig()
      welcomeDiscount = computeWelcomeDiscount(subtotal, cfg)
      if (welcomeDiscount > 0) {
        welcomeApplied = true
        discount = welcomeDiscount
      }
    }
  }

  const afterDiscount = subtotal - discount

  // Bonus: только для retail.
  let bonusUsed = 0
  if (!isWholesale && data.bonusAmount && data.bonusAmount > 0 && data.userId) {
    const user = await prisma.user.findUnique({
      where: { id: data.userId },
      select: { bonusBalance: true },
    })
    const maxBonus = Math.floor(afterDiscount * 0.5)
    bonusUsed = Math.min(data.bonusAmount, maxBonus, user?.bonusBalance ?? 0)
  }

  // Позиции для расчёта плана упаковки и, соответственно, цены доставки
  const packingItems: ItemToPack[] = data.items
    .map((i) => ({ weightGrams: parseItemWeightGrams(i.weight), quantity: i.quantity }))
    .filter((i) => i.weightGrams > 0 && i.quantity > 0)

  // Строим физический план упаковки — сохраняем в заказ для прозрачности отгрузки.
  const packagePlan = packingItems.length > 0 ? await buildPackagePlan(packingItems) : null
  const totalPackageWeight = packagePlan
    ? packagePlan.reduce((s, p) => s + p.weight, 0)
    : null

  // Delivery price: always calculate server-side, never trust client price.
  // Передаём ВСЕ доступные параметры локации (город-строка нужен для Почты,
  // когда у клиента нет postalCode — провайдер разрешает через DaData/by-address).
  let deliveryPrice = 0
  if (data.tariffCode !== undefined && data.deliveryMethod) {
    const rates = await calculateDeliveryRates({
      toCityCode: data.destinationCityCode,
      toPostalCode: data.postalCode,
      toCity: data.destinationCity,
      items: packingItems,
      cartTotal: afterDiscount - bonusUsed,
    })
    const matchingRate = rates.find(
      (r) => r.tariffCode === data.tariffCode && r.carrier === data.deliveryMethod
    )
    if (!matchingRate) {
      throw new Error(
        `Выбранный тариф ${data.deliveryMethod}/${data.tariffCode} недоступен. ` +
          `Провайдеры вернули: ${rates.map((r) => `${r.carrier}/${r.tariffCode}`).join(", ") || "ничего"}. ` +
          `Обновите страницу и выберите доставку заново`
      )
    }
    deliveryPrice = matchingRate.priceWithMarkup

    // Trust-guard. Клиент видел в UI цену data.deliveryPrice. Если сервер
    // насчитал БОЛЬШЕ — никогда молча не списываем разницу (и не пишем
    // в email/в платёж YooKassa). Допуск 1₽ — на разные направления
    // округлений между провайдерами.
    //
    // Если deliveryPrice не пришёл вообще (старый клиент / B2B-flow без
    // тарифа выбора / неправильный body) — для retail тоже падаем: не
    // должно быть пути «выбрана доставка, но клиент не знает её цену».
    // Для wholesale guard выключаем — там цена доставки часто = 0 или
    // считается отдельно через прайс-листы.
    if (!isWholesale) {
      if (!Number.isFinite(data.deliveryPrice)) {
        throw new DeliveryPriceMismatchError(0, deliveryPrice)
      }
      if (deliveryPrice > (data.deliveryPrice as number) + 1) {
        throw new DeliveryPriceMismatchError(
          data.deliveryPrice as number,
          deliveryPrice
        )
      }
    }
  }
  const total = afterDiscount - bonusUsed + deliveryPrice

  // Pass-2-B: total-guard. Поверх delivery-guard'а проверяем итоговую сумму —
  // ловит любой mismatch (welcome, promo, gift availability changing
  // discount slot, future bonus). Допуск 2₽ — суммируется округление по
  // двум статьям (discount + delivery). Для wholesale выключен.
  if (!isWholesale && Number.isFinite(data.expectedFinalTotal)) {
    const expected = data.expectedFinalTotal as number
    if (total > expected + 2) {
      throw new TotalMismatchError(expected, total)
    }
  }

  // G5: валидация выбранного подарка. cartTotal для проверки доступности =
  // afterDiscount (после скидки) — это согласовано с фронтом и с DAL
  // getAvailableGifts. Bonus не вычитаем чтобы не "лишать" подарка при оплате
  // бонусами.
  // Подарок оставляем опциональным: если клиент не выбрал — нет подарка.
  // Если он выбрал не-существующий/недоступный/закончившийся — выбрасываем
  // ошибку, требующую обновить страницу.
  const cartTotalForGift = afterDiscount
  type GiftAttachment = {
    id: string
    name: string
    // Для linked-gift — id и остаток ProductVariant (используем в tx для adjustStock).
    // Для custom — null и локальный stock.
    productVariantId: string | null
    stock: number | null
  }
  let giftToAttach: GiftAttachment | null = null
  // Kill-switch: если админ выключил программу между рендером checkout
  // и submit'ом, игнорируем selectedGiftId без ошибки — юзер получит обычный
  // заказ, подарка не будет. Это лучше чем ронять оформление.
  const giftsProgramEnabled = !isWholesale && (await areGiftsEnabled())
  if (giftsProgramEnabled && data.selectedGiftId) {
    const gift = await prisma.gift.findUnique({
      where: { id: data.selectedGiftId },
      select: {
        id: true,
        name: true,
        isActive: true,
        minCartTotal: true,
        stock: true,
        productVariantId: true,
        productVariant: {
          select: { stock: true, isActive: true, product: { select: { isActive: true } } },
        },
      },
    })
    if (!gift || !gift.isActive) {
      throw new Error("Выбранный подарок больше недоступен. Обновите страницу и выберите заново")
    }
    if (cartTotalForGift < gift.minCartTotal) {
      throw new Error(
        `Подарок "${gift.name}" доступен от ${gift.minCartTotal}₽. Добавьте товаров или выберите другой`
      )
    }
    // Для linked-gift проверяем сам ProductVariant + родительский Product
    if (gift.productVariantId) {
      if (!gift.productVariant || !gift.productVariant.isActive || !gift.productVariant.product.isActive) {
        throw new Error(`Подарок "${gift.name}" больше недоступен. Выберите другой`)
      }
      if (gift.productVariant.stock <= 0) {
        throw new Error(`Подарок "${gift.name}" закончился на складе. Выберите другой`)
      }
    } else if (gift.stock !== null && gift.stock <= 0) {
      // Custom gift с исчерпанным запасом
      throw new Error(`Подарок "${gift.name}" закончился. Выберите другой`)
    }
    giftToAttach = {
      id: gift.id,
      name: gift.name,
      productVariantId: gift.productVariantId,
      stock: gift.productVariantId ? gift.productVariant?.stock ?? null : gift.stock,
    }
  }

  const order = await prisma.$transaction(async (tx) => {
    // Atomically verify and increment promo usage inside the transaction.
    // Pre-validation (above) is advisory; this is the real guard against race conditions.
    if (promoCodeId) {
      const affected = await tx.$executeRaw`
        UPDATE "PromoCode"
        SET "usageCount" = "usageCount" + 1
        WHERE id = ${promoCodeId}
          AND "isActive" = true
          AND "endDate" > NOW()
          AND ("maxUsage" IS NULL OR "usageCount" < "maxUsage")
      `
      if (affected === 0) {
        throw new Error("Промокод недействителен или исчерпан. Попробуйте оформить заказ без него")
      }
    }

    // Кредит-механика убрана: все оптовые заказы идут по счёту (100%
    // предоплата) через approve-flow. Проверок лимита больше нет.

    const created = await tx.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        thankYouToken: generateToken(),
        trackingToken: generateToken(),
        clientRequestId: data.clientRequestId ?? null,
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        deliveryAddress: data.deliveryAddress,
        deliveryMethod: data.deliveryMethod,
        paymentMethod: data.paymentMethod,
        notes: data.notes,
        userId: data.userId,
        subtotal,
        discount,
        deliveryPrice,
        total,
        bonusUsed,
        promoCodeId,
        // Delivery module fields
        deliveryType: data.deliveryType,
        pickupPointCode: data.pickupPointCode,
        pickupPointName: data.pickupPointName,
        destinationCity: data.destinationCity,
        destinationCityCode: data.destinationCityCode,
        estimatedDelivery: data.estimatedDelivery,
        tariffCode: data.tariffCode,
        postalCode: data.postalCode,
        packagePlan: (packagePlan ?? undefined) as Prisma.InputJsonValue | undefined,
        packageWeight: totalPackageWeight ?? undefined,
        selectedGiftId: giftToAttach?.id ?? null,
        giftNameSnapshot: giftToAttach?.name ?? null,
        // B2B разметка
        channel,
        wholesaleCompanyId: isWholesale ? data.wholesaleCompanyId ?? null : null,
        wholesaleUserId: isWholesale ? data.wholesaleUserId ?? null : null,
        paymentTerms: isWholesale ? data.paymentTerms ?? null : null,
        approvalStatus: isWholesale ? data.approvalStatus ?? null : null,
        b2bLegalName: isWholesale ? data.b2bLegalName ?? null : null,
        b2bInn: isWholesale ? data.b2bInn ?? null : null,
        b2bKpp: isWholesale ? data.b2bKpp ?? null : null,
        // Пометка для склада в adminNotes — чтобы упаковщик увидел когда
        // раскроет заказ в админке. Если юзер также оставил комментарий — не
        // затираем, а добавляем сверху.
        adminNotes: giftToAttach
          ? `🎁 Вложить подарок: ${giftToAttach.name}`
          : undefined,
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            name: item.name,
            weight: item.weight,
            price: item.price,
            quantity: item.quantity,
          })),
        },
      },
      include: { items: true },
    })

    // Декремент подарка:
    //   - linked-gift (productVariantId) → adjustStock(-1, reason="gifted")
    //     с записью в StockHistory для аудита "куда ушёл товар"
    //   - custom gift с числовым stock → UPDATE Gift SET stock-1 WHERE stock>0
    //   - unlimited custom (stock=null без линка) → no-op
    // Везде condition-based (stock > 0 или SELECT FOR UPDATE внутри adjustStock) —
    // защита от race при одновременных заказах на последний экземпляр.
    if (giftToAttach) {
      if (giftToAttach.productVariantId) {
        try {
          await adjustStock(
            {
              variantId: giftToAttach.productVariantId,
              delta: -1,
              reason: "gifted",
              orderId: created.id,
              notes: `Подарок в заказе ${created.orderNumber}`,
              changedBy: "system",
            },
            tx
          )
        } catch (e) {
          throw new Error(
            e instanceof Error && e.message.startsWith("Недостаточно")
              ? `Подарок "${giftToAttach.name}" закончился на складе. Выберите другой`
              : `Не удалось зарезервировать подарок "${giftToAttach.name}"`
          )
        }
      } else if (giftToAttach.stock !== null) {
        const affected = await tx.$executeRaw`
          UPDATE "Gift" SET stock = stock - 1
          WHERE id = ${giftToAttach.id} AND stock > 0
        `
        if (affected === 0) {
          throw new Error(`Подарок "${giftToAttach.name}" закончился. Выберите другой`)
        }
      }
    }

    // Декремент остатков через adjustStock — атомарно, с историей и пересечением порогов.
    const stockResults: StockAdjustResult[] = []
    for (const item of data.items) {
      try {
        const res = await adjustStock(
          {
            variantId: item.variantId,
            delta: -item.quantity,
            reason: "order_placed",
            orderId: created.id,
            changedBy: data.userId || "customer",
          },
          tx
        )
        stockResults.push(res)
      } catch (e) {
        throw new Error(
          e instanceof Error && e.message.startsWith("Недостаточно")
            ? `"${item.name}" — недостаточно на складе. Обновите корзину`
            : `Ошибка списания со склада для "${item.name}"`
        )
      }
    }

    // Deduct bonuses with real orderId (after order is created)
    if (bonusUsed > 0 && data.userId) {
      await deductBonusesInTx(tx, data.userId, created.id, bonusUsed)
    }

    // Credit-ledger полностью убран — все оптовые заказы идут по счёту
    // (100% предоплата), долги не копятся.

    // G1-1: firstOrderCompletedAt — ставим при ЛЮБОМ первом заказе (не только
    // когда welcome applied). Это корректный маркер «был ли вообще first order»,
    // нужный и для welcome-exhaustion, и для referral-check ниже.
    // Определяем "первый" через data.userId + свежее чтение User (в рамках
    // той же транзакции — мы ещё не обновили).
    let isFirstOrder = false
    if (data.userId) {
      const u = await tx.user.findUnique({
        where: { id: data.userId },
        select: { firstOrderCompletedAt: true },
      })
      if (u && u.firstOrderCompletedAt === null) {
        isFirstOrder = true
        await tx.user.update({
          where: { id: data.userId },
          data: { firstOrderCompletedAt: new Date() },
        })
      }
    }

    // G2: реферальная награда. Условия:
    //   - есть data.referralCode (из cookie `ref`)
    //   - юзер зарегистрирован (data.userId) — без userId бонусы некуда класть
    //   - это ПЕРВЫЙ заказ (isFirstOrder, определён выше НЕЗАВИСИМО от welcome-
    //     стекования: юзер может использовать promo-код и всё равно получить
    //     reward для inviter'а — это по факту первая покупка в системе).
    //   - code существует и не expired
    //   - inviter != invitee (сам-на-себя — абуз)
    //   - реферальная программа включена (setting)
    if (data.referralCode && data.userId && isFirstOrder) {
      try {
        const cfg = await getReferralConfig()
        if (cfg.enabled) {
          const refCode = await findActiveReferralCode(data.referralCode)
          if (refCode && refCode.userId !== data.userId) {
            await applyReferralReward(tx, {
              referralCodeId: refCode.id,
              inviterUserId: refCode.userId,
              referredUserId: data.userId,
              orderId: created.id,
              inviterBonus: cfg.inviterBonus,
              inviteeBonus: cfg.inviteeBonus,
            })
          }
        }
      } catch (e) {
        // Referral не блокирует заказ — логируем и идём дальше.
        console.error("[createOrder] referral reward failed:", e)
      }
    }

    return { created, stockResults }
  })

  // После commit — асинхронно уведомляем millorbot о критичных переходах
  void notifyStockChanges(order.stockResults)

  return order.created
}

export async function getOrders(filters: { status?: string; search?: string; channel?: string; paymentStatus?: string; page?: number; limit?: number } = {}) {
  const { status, search, channel, paymentStatus, page = 1, limit = 20 } = filters

  const conditions: Record<string, unknown>[] = []
  if (status) conditions.push({ status })
  if (channel && channel !== "all") conditions.push({ channel })
  // I5 (B-4): отдельный фильтр по платёжному статусу. Полезно админу
  // чтобы быстро найти заказы, ждущие оплаты, и переотправить ссылку.
  if (paymentStatus) conditions.push({ paymentStatus })
  if (search) {
    conditions.push({
      OR: [
        { orderNumber: { contains: search, mode: "insensitive" as const } },
        { customerPhone: { contains: search } },
        { customerEmail: { contains: search, mode: "insensitive" as const } },
        { customerName: { contains: search, mode: "insensitive" as const } },
        { b2bLegalName: { contains: search, mode: "insensitive" as const } },
        { b2bInn: { contains: search } },
      ],
    })
  }
  const where = conditions.length > 0 ? { AND: conditions } : {}

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        items: true,
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where }),
  ])

  return { orders, total }
}

export async function getOrderById(id: string) {
  return prisma.order.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          product: { select: { name: true, slug: true } },
        },
      },
      promoCode: {
        select: { code: true, name: true, type: true, value: true },
      },
      statusLogs: {
        orderBy: { createdAt: "desc" },
      },
    },
  })
}

export async function getOrdersByUserId(userId: string, { page = 1, limit = 10 } = {}) {
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        items: true,
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where: { userId } }),
  ])

  return { orders, total }
}

/**
 * Строгая state-machine заказа (P1-13).
 *
 * Правила:
 * - pending → paid | confirmed | cancelled
 * - paid → confirmed | shipped | cancelled
 * - confirmed → shipped | cancelled
 * - shipped → delivered | cancelled (cancelled редкий — например, посылка
 *   утеряна перевозчиком; stock при этом НЕ возвращается, товар физически
 *   уехал)
 * - delivered — terminal: никаких обратных переходов. Если нужно
 *   аннулировать — только через админ SQL или отдельный "returned" flow.
 * - cancelled — terminal: нельзя восстановить в pending. Раньше можно было,
 *   но это приводило к двойным рассылкам и неконсистентным stock-adjustments.
 *   Если нужно оформить заказ снова — клиент делает новый.
 * - payment_failed → pending | cancelled (pending даёт shot у повторной
 *   оплаты в течение сессии; чаще же идёт в cancelled).
 */
export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ["paid", "confirmed", "cancelled"],
  paid: ["confirmed", "shipped", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
  payment_failed: ["pending", "cancelled"],
}

export async function updateOrderStatus(id: string, status: string, changedBy?: string) {
  // Валидация против whitelist — защита от невалидного string попавшего
  // в БД через случайный API-вызов. Runtime parse + TS-typed throw.
  const { parseOrderStatus } = await import("@/lib/order-status")
  const validatedStatus = parseOrderStatus(status)
  status = validatedStatus
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: { select: { variantId: true, quantity: true, name: true } } },
  })
  if (!order) throw new Error("Заказ не найден")

  const allowed = ALLOWED_TRANSITIONS[order.status] || []
  if (!allowed.includes(status)) {
    throw new Error(`Нельзя перевести заказ из "${order.status}" в "${status}"`)
  }

  // P1-14: если заказ был delivered и bonusEarned > 0, при любом переходе
  // в cancelled/returned нужно списать начисленные бонусы, иначе юзер
  // получает cashback за не полученный товар. Сейчас ALLOWED_TRANSITIONS
  // запрещает delivered → что-либо, но держим safeguard на случай
  // расширения матрицы в будущем.
  if (
    status === "cancelled" &&
    order.userId &&
    order.bonusEarned > 0 &&
    ["shipped", "delivered"].includes(order.status)
  ) {
    await reverseOrderEarnedBonuses(order.userId, id)
  }

  // Stock-side-effect: возвращаем товар на склад только если заказ отменяем
  // ДО отгрузки (pending/paid/confirmed → cancelled). При shipped → cancelled
  // stock НЕ трогаем — товар уже едет/уехал; если будет возврат, админ
  // сделает adjustStock вручную через отдельный возвратный flow.
  const isCancellingBeforeShipment =
    status === "cancelled" && ["pending", "paid", "confirmed"].includes(order.status)

  const stockResults: StockAdjustResult[] = []

  const updated = await prisma.$transaction(async (tx) => {
    if (isCancellingBeforeShipment) {
      for (const item of order.items) {
        if (!item.variantId) continue
        const res = await adjustStock(
          {
            variantId: item.variantId,
            delta: +item.quantity,
            reason: "order_cancelled",
            orderId: id,
            changedBy: changedBy || "admin",
          },
          tx
        )
        stockResults.push(res)
      }
      // GF1: возвращаем gift-stock при отмене до отгрузки. Одно обнуление
      // selectedGiftId предотвращает double-refund если cancel повторится.
      if (order.selectedGiftId) {
        await refundGiftStock(order.selectedGiftId, tx)
        await tx.order.update({
          where: { id },
          data: { selectedGiftId: null },
        })
      }

    }

    const upd = await tx.order.update({
      where: { id },
      data: { status },
    })
    await tx.orderStatusLog.create({
      data: {
        orderId: id,
        fromStatus: order.status,
        toStatus: status,
        changedBy: changedBy || null,
      },
    })
    return upd
  })

  if (stockResults.length > 0) {
    void notifyStockChanges(stockResults)
  }
  return updated
}
