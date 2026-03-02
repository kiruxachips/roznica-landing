"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { deleteArticle, toggleArticlePublished } from "@/lib/actions/articles"
import { ConfirmDialog } from "@/components/admin/ConfirmDialog"
import { Pencil, Trash2, Eye, EyeOff } from "lucide-react"

export function ArticleActions({
  articleId,
  articleTitle,
  isPublished,
}: {
  articleId: string
  articleTitle: string
  isPublished: boolean
}) {
  const router = useRouter()

  return (
    <div className="flex items-center gap-1">
      <Link href={`/admin/blog/${articleId}`} className="p-2 text-muted-foreground hover:text-primary rounded-lg hover:bg-muted transition-colors" title="Редактировать">
        <Pencil className="w-4 h-4" />
      </Link>
      <button
        onClick={async () => {
          await toggleArticlePublished(articleId)
          router.refresh()
        }}
        className="p-2 text-muted-foreground hover:text-primary rounded-lg hover:bg-muted transition-colors"
        title={isPublished ? "Снять с публикации" : "Опубликовать"}
      >
        {isPublished ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
      <ConfirmDialog
        title="Удалить статью?"
        message={`Статья "${articleTitle}" будет удалена безвозвратно.`}
        onConfirm={async () => {
          await deleteArticle(articleId)
          router.refresh()
        }}
      >
        {(open) => (
          <button onClick={open} className="p-2 text-muted-foreground hover:text-red-600 rounded-lg hover:bg-muted transition-colors" title="Удалить">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </ConfirmDialog>
    </div>
  )
}
