"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath, revalidateTag } from "next/cache"
import { requireAdmin, logAdminAction } from "@/lib/admin-guard"
import { CACHE_TAGS } from "@/lib/cache-tags"

function invalidateReviewsCache() {
  revalidateTag(CACHE_TAGS.products)
  revalidateTag(CACHE_TAGS.catalog)
  revalidateTag(CACHE_TAGS.stats)
  revalidatePath("/admin/reviews")
}

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
  invalidateReviewsCache()
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
  invalidateReviewsCache()
}
