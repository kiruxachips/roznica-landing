"use client"

import { useRouter } from "next/navigation"
import { toggleReviewVisibility, deleteReview } from "@/lib/actions/reviews"
import { ConfirmDialog } from "@/components/admin/ConfirmDialog"
import { Eye, Trash2 } from "lucide-react"

export function ReviewActions({ reviewId, reviewName }: { reviewId: string; reviewName: string }) {
  const router = useRouter()

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={async () => {
          await toggleReviewVisibility(reviewId)
          router.refresh()
        }}
        className="p-2 text-muted-foreground hover:text-primary rounded-lg hover:bg-muted transition-colors"
        title="Переключить видимость"
      >
        <Eye className="w-4 h-4" />
      </button>
      <ConfirmDialog
        title="Удалить отзыв?"
        message={`Отзыв от "${reviewName}" будет удалён.`}
        onConfirm={async () => {
          await deleteReview(reviewId)
          router.refresh()
        }}
      >
        {(open) => (
          <button onClick={open} className="p-2 text-muted-foreground hover:text-red-600 rounded-lg hover:bg-muted transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </ConfirmDialog>
    </div>
  )
}
