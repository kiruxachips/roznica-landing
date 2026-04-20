"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { requireAdmin, logAdminAction } from "@/lib/admin-guard"

export async function toggleReviewVisibility(id: string) {
  const admin = await requireAdmin("reviews.moderate")
  const review = await prisma.review.findUnique({ where: { id } })
  if (!review) throw new Error("Review not found")

  await prisma.review.update({
    where: { id },
    data: { isVisible: !review.isVisible },
  })

  void logAdminAction({
    admin,
    action: "review.toggle_visibility",
    entityType: "review",
    entityId: id,
    payload: { wasVisible: review.isVisible, nowVisible: !review.isVisible },
  })
  revalidatePath("/admin/reviews")
  revalidatePath("/catalog")
}

export async function deleteReview(id: string) {
  const admin = await requireAdmin("reviews.delete")
  await prisma.review.delete({ where: { id } })
  void logAdminAction({
    admin,
    action: "review.deleted",
    entityType: "review",
    entityId: id,
  })
  revalidatePath("/admin/reviews")
  revalidatePath("/catalog")
}
