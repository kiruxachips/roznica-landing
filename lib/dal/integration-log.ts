import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

export interface LogIntegrationInput {
  direction: "inbound" | "outbound"
  source: string
  event: string
  eventId?: string | null
  statusCode?: number | null
  request?: Prisma.InputJsonValue
  response?: Prisma.InputJsonValue
  error?: string | null
  durationMs?: number | null
}

export async function logIntegration(input: LogIntegrationInput) {
  try {
    await prisma.integrationLog.create({
      data: {
        direction: input.direction,
        source: input.source,
        event: input.event,
        eventId: input.eventId ?? null,
        statusCode: input.statusCode ?? null,
        request: input.request as Prisma.InputJsonValue | undefined,
        response: input.response as Prisma.InputJsonValue | undefined,
        error: input.error?.slice(0, 4000) ?? null,
        durationMs: input.durationMs ?? null,
      },
    })
  } catch (e) {
    console.error("Failed to write IntegrationLog:", e)
  }
}
