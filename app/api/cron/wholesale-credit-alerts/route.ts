import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Кредит-механика убрана — все оптовые заказы работают по схеме
 * «заявка → счёт → 100% предоплата». Эндпоинт оставлен, чтобы
 * outbox-worker не ронял 404 при тике; просто возвращает пустой результат.
 */
export async function POST(request: NextRequest) {
  const expected = process.env.CRON_SECRET
  if (expected && request.headers.get("x-cron-secret") !== expected) {
    return NextResponse.json({ error: "Forbidden" }, { status: 401 })
  }
  return NextResponse.json({ checked: 0, alerted: 0, reset: 0, disabled: true })
}
