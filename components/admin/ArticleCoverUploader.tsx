"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { uploadArticleCoverImage, deleteArticleCoverImage } from "@/lib/actions/articles"
import { Trash2, Upload } from "lucide-react"

interface ArticleCoverUploaderProps {
  articleId: string
  coverImage: string | null
}

export function ArticleCoverUploader({ articleId, coverImage }: ArticleCoverUploaderProps) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.set("file", file)
      formData.set("articleId", articleId)
      await uploadArticleCoverImage(formData)
      router.refresh()
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  async function handleDelete() {
    await deleteArticleCoverImage(articleId)
    router.refresh()
  }

  return (
    <div>
      {coverImage && (
        <div className="relative group rounded-lg overflow-hidden border border-border mb-4 max-w-md">
          <Image src={coverImage} alt="Обложка" width={600} height={400} className="w-full aspect-[3/2] object-cover" />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <button onClick={handleDelete} className="p-2 bg-white rounded-full hover:bg-gray-100 text-red-600" title="Удалить обложку">
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-2 px-4 py-2 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
      >
        <Upload className="w-4 h-4" />
        {uploading ? "Загрузка..." : coverImage ? "Заменить обложку" : "Загрузить обложку"}
      </button>
    </div>
  )
}
