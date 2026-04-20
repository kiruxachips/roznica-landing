import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { attemptSend } from "@/lib/dal/email-dispatch"
import { sendRenderedEmail } from "@/lib/email"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const BATCH = 10

/**
 * Пинается `scripts/outbox-worker.mjs` раз в 30 с. Забирает EmailDispatch
 * в status="pending"|"failed" с nextAttemptAt<=now и пытается отправить SMTP.
 * attemptSend сам обновит status=sent или failed с backoff.
 *
 * Защита: X-Cron-Secret header === CRON_SECRET env var. Без секрета endpoint
 * возвращает 401. В docker network доступен только outbox-worker'у.
 */
export async function POST(request: NextRequest) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 })
  }
  const actual = request.headers.get("x-cron-secret")
  if (actual !== expected) {
    return NextResponse.json({ error: "Forbidden" }, { status: 401 })
  }

  const ready = await prisma.emailDispatch.findMany({
    where: {
      status: { in: ["pending", "failed"] },
      nextAttemptAt: { lte: new Date() },
      // Нечего переотправлять, если snapshot пустой (ранние записи без subject/html).
      subject: { not: null },
      html: { not: null },
    },
    orderBy: { nextAttemptAt: "asc" },
    take: BATCH,
    select: {
      id: true,
      recipient: true,
      subject: true,
      html: true,
      fromEmail: true,
      kind: true,
    },
  })

  if (ready.length === 0) {
    return NextResponse.json({ processed: 0 })
  }

  let sent = 0
  let failed = 0
  for (const row of ready) {
    if (!row.subject || !row.html) continue
    const before = Date.now()
    try {
      await attemptSend(
        row.id,
        sendRenderedEmail,
        {
          to: row.recipient,
          subject: row.subject,
          html: row.html,
          fromEmail: row.fromEmail ?? undefined,
        }
      )
      // attemptSend пишет sent/failed внутри — проверим результат для метрики.
      const after = await prisma.emailDispatch.findUnique({
        where: { id: row.id },
        select: { status: true },
      })
      if (after?.status === "sent") sent++
      else failed++
    } catch (e) {
      failed++
      console.error(`[cron-retry-emails] unexpected error for ${row.id}:`, e, "duration:", Date.now() - before)
    }
  }

  // Сколько dead перешло за этот тик — для мониторинга
  const dead = await prisma.emailDispatch.count({
    where: {
      status: "dead",
      updatedAt: { gte: new Date(Date.now() - 60_000) },
    },
  })

  return NextResponse.json({ processed: ready.length, sent, failed, dead })
}
