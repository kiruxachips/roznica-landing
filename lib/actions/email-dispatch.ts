"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { attemptSend } from "@/lib/dal/email-dispatch"
import { sendRenderedEmail } from "@/lib/email"
import { requireAdmin, logAdminAction } from "@/lib/admin-guard"

/**
 * Ручной retry письма из админки. Сбрасывает nextAttemptAt в now, вызывает attemptSend.
 * Работает для status in (pending|failed|dead). "sent" — не ретраит (idempotency).
 */
export async function retryEmailDispatchAction(id: string) {
  const admin = await requireAdmin("email.retry")

  const row = await prisma.emailDispatch.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      recipient: true,
      subject: true,
      html: true,
      fromEmail: true,
      kind: true,
    },
  })
  if (!row) throw new Error("Запись не найдена")
  if (row.status === "sent") {
    throw new Error("Письмо уже отправлено")
  }
  if (!row.subject || !row.html) {
    throw new Error("Нет snapshot'а письма (subject/html) — не можем повторить отправку")
  }

  // Сбрасываем attempts на 0 чтобы не считать ручной retry как автоматический —
  // dead-сквоз вручную разрешён.
  await prisma.emailDispatch.update({
    where: { id },
    data: { status: "pending", attempts: 0, nextAttemptAt: new Date(), error: null },
  })

  await attemptSend(id, sendRenderedEmail, {
    to: row.recipient,
    subject: row.subject,
    html: row.html,
    fromEmail: row.fromEmail ?? undefined,
  })

  void logAdminAction({
    admin,
    action: "email.retry",
    entityType: "email_dispatch",
    entityId: id,
    payload: { kind: row.kind, recipient: row.recipient },
  })

  revalidatePath("/admin/email-dispatch")
}
