"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { uploadImage, deleteImage, setPrimaryImage } from "@/lib/actions/images"
import { Trash2, Star, Upload } from "lucide-react"

interface ProductImage {
  id: string
  url: string
  alt: string | null
  isPrimary: boolean
}

export function ImageUploader({ productId, images }: { productId: string; images: ProductImage[] }) {
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
      formData.set("productId", productId)
      await uploadImage(formData)
      router.refresh()
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  async function handleDelete(id: string) {
    await deleteImage(id)
    router.refresh()
  }

  async function handleSetPrimary(id: string) {
    await setPrimaryImage(id)
    router.refresh()
  }

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        {images.map((img) => (
          <div key={img.id} className="relative group rounded-lg overflow-hidden border border-border">
            <Image src={img.url} alt={img.alt ?? ""} width={200} height={200} className="w-full aspect-square object-cover" />
            {img.isPrimary && (
              <span className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded">Основное</span>
            )}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              {!img.isPrimary && (
                <button onClick={() => handleSetPrimary(img.id)} className="p-2 bg-white rounded-full hover:bg-gray-100" title="Сделать основным">
                  <Star className="w-4 h-4" />
                </button>
              )}
              <button onClick={() => handleDelete(img.id)} className="p-2 bg-white rounded-full hover:bg-gray-100 text-red-600" title="Удалить">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-2 px-4 py-2 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
      >
        <Upload className="w-4 h-4" />
        {uploading ? "Загрузка..." : "Загрузить изображение"}
      </button>
    </div>
  )
}
