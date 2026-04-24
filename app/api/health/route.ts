import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Health-check endpoint для внешних мониторов (UptimeRobot, BetterStack).
 *
 * Проверяет критические зависимости:
 * - DB (SELECT 1 через Prisma)
 *
 * НЕ проверяем SMTP/ЮKassa/СДЭК: их падение не делает сайт нерабочим
 * (checkout graceful degradation + outbox retry), и каждая проверка
 * стоит денег/времени. Только liveness БД, без которой приложение
 * бесполезно.
 *
 * 200 — всё ок. 503 — БД недоступна, нужно срочно разбираться.
 * Уведомление админу через UptimeRobot → Telegram.
 */
export async function GET() {
  const checks: Record<string, { ok: boolean; latencyMs?: number; error?: string }> = {}

  // DB liveness
  const dbStart = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    checks.db = { ok: true, latencyMs: Date.now() - dbStart }
  } catch (e) {
    checks.db = {
      ok: false,
      latencyMs: Date.now() - dbStart,
      error: e instanceof Error ? e.message.slice(0, 200) : "unknown",
    }
  }

  const allOk = Object.values(checks).every((c) => c.ok)
  const body = {
    status: allOk ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    checks,
  }

  return NextResponse.json(body, {
    status: allOk ? 200 : 503,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  })
}
