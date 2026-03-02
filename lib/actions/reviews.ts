"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function toggleReviewVisibility(id: string) {
  const review = await prisma.review.findUnique({ where: { id } })
  if (!review) throw new Error("Review not found")

  await prisma.review.update({
    where: { id },
    data: { isVisible: !review.isVisible },
  })

  revalidatePath("/admin/reviews")
  revalidatePath("/catalog")
}

export async function deleteReview(id: string) {
  await prisma.review.delete({ where: { id } })
  revalidatePath("/admin/reviews")
  revalidatePath("/catalog")
}
