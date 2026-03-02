"use client"

import { useState } from "react"

interface ConfirmDialogProps {
  title: string
  message: string
  onConfirm: () => Promise<void> | void
  children: (open: () => void) => React.ReactNode
}

export function ConfirmDialog({ title, message, onConfirm, children }: ConfirmDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    setLoading(true)
    try {
      await onConfirm()
    } finally {
      setLoading(false)
      setIsOpen(false)
    }
  }

  return (
    <>
      {children(() => setIsOpen(true))}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setIsOpen(false)} />
          <div className="relative bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-2">{title}</h3>
            <p className="text-sm text-muted-foreground mb-6">{message}</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {loading ? "Удаление..." : "Удалить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
