"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { deleteProduct, toggleProductActive } from "@/lib/actions/products"
import { ConfirmDialog } from "@/components/admin/ConfirmDialog"
import { Pencil, Trash2, Eye, EyeOff } from "lucide-react"

export function ProductActions({ productId, productName }: { productId: string; productName: string }) {
  const router = useRouter()

  return (
    <div className="flex items-center gap-1">
      <Link href={`/admin/products/${productId}`} className="p-2 text-muted-foreground hover:text-primary rounded-lg hover:bg-muted transition-colors" title="Редактировать">
        <Pencil className="w-4 h-4" />
      </Link>
      <button
        onClick={async () => {
          await toggleProductActive(productId)
          router.refresh()
        }}
        className="p-2 text-muted-foreground hover:text-primary rounded-lg hover:bg-muted transition-colors"
        title="Переключить видимость"
      >
        <Eye className="w-4 h-4" />
      </button>
      <ConfirmDialog
        title="Удалить товар?"
        message={`Товар "${productName}" будет удалён безвозвратно.`}
        onConfirm={async () => {
          await deleteProduct(productId)
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
