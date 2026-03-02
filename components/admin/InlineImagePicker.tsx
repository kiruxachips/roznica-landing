"use client"

import { useRef } from "react"

interface InlineImagePickerProps {
  images: File[]
  onChange: (images: File[]) => void
}

export function InlineImagePicker({ images, onChange }: InlineImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length > 0) {
      onChange([...images, ...files])
    }
    // Reset input so the same file can be selected again
    if (inputRef.current) inputRef.current.value = ""
  }

  function handleRemove(index: number) {
    onChange(images.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {images.map((file, index) => (
            <div key={`${file.name}-${index}`} className="relative group">
              <img
                src={URL.createObjectURL(file)}
                alt={file.name}
                className="w-24 h-24 object-cover rounded-lg border border-border"
              />
              {index === 0 && (
                <span className="absolute top-1 left-1 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded">
                  Главная
                </span>
              )}
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                &times;
              </button>
              <span className="block text-[10px] text-muted-foreground mt-1 truncate max-w-[96px]">
                {file.name}
              </span>
            </div>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFiles}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="px-4 py-2 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
      >
        + Добавить изображения
      </button>
    </div>
  )
}
