"use server"

import { revalidatePath } from "next/cache"
import { retryDeadOutbox } from "@/lib/dal/outbox"

export async function retryOutboxAction(id: string) {
  await retryDeadOutbox(id)
  revalidatePath("/admin/integrations")
}
