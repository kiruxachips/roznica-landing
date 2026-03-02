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
  const res = await fetch(`${YOOKASSA_API}/payments`, {
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
