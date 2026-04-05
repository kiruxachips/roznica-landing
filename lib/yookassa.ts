import { fetchWithTimeout } from "./delivery/utils"

const YOOKASSA_API = "https://api.yookassa.ru/v3"

function getAuth() {
  const shopId = process.env.YOOKASSA_SHOP_ID
  const secretKey = process.env.YOOKASSA_SECRET_KEY
  if (!shopId || !secretKey) {
    throw new Error("YOOKASSA_SHOP_ID and YOOKASSA_SECRET_KEY must be set")
  }
  return Buffer.from(`${shopId}:${secretKey}`).toString("base64")
}

interface CreatePaymentParams {
  orderId: string
  orderNumber: string
  amount: number // in rubles
  returnUrl: string
  description: string
}

interface YookassaPayment {
  id: string
  status: string
  confirmation?: {
    type: string
    confirmation_url: string
  }
}

export async function createPayment({
  orderId,
  orderNumber,
  amount,
  returnUrl,
  description,
}: CreatePaymentParams): Promise<YookassaPayment> {
  const res = await fetchWithTimeout(`${YOOKASSA_API}/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${getAuth()}`,
      "Idempotence-Key": orderId,
    },
    body: JSON.stringify({
      amount: {
        value: amount.toFixed(2),
        currency: "RUB",
      },
      capture: true,
      confirmation: {
        type: "redirect",
        return_url: returnUrl,
      },
      description,
      metadata: {
        orderId,
        orderNumber,
      },
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`YooKassa API error ${res.status}: ${body}`)
  }

  return res.json()
}

/**
 * Verify payment status directly via YooKassa API.
 * Used in webhook handler to ensure the payment data is authentic
 * (not spoofed), since YooKassa doesn't provide HMAC signatures.
 */
export async function getPayment(paymentId: string): Promise<YookassaPayment & {
  status: string
  amount: { value: string; currency: string }
  metadata?: { orderId?: string; orderNumber?: string }
}> {
  const res = await fetchWithTimeout(`${YOOKASSA_API}/payments/${paymentId}`, {
    method: "GET",
    headers: {
      Authorization: `Basic ${getAuth()}`,
    },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`YooKassa GET payment error ${res.status}: ${body}`)
  }

  return res.json()
}

interface YookassaRefund {
  id: string
  status: string
  amount: { value: string; currency: string }
}

export async function createRefund(paymentId: string, amount: number, orderId?: string): Promise<YookassaRefund> {
  // Deterministic key: retrying the same refund won't create a duplicate
  const idempotenceKey = `refund-${paymentId}-${orderId || "full"}`
  const res = await fetchWithTimeout(`${YOOKASSA_API}/refunds`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${getAuth()}`,
      "Idempotence-Key": idempotenceKey,
    },
    body: JSON.stringify({
      payment_id: paymentId,
      amount: {
        value: amount.toFixed(2),
        currency: "RUB",
      },
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`YooKassa refund error ${res.status}: ${body}`)
  }

  return res.json()
}
