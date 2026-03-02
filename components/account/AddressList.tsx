"use client"

import { useState, useTransition } from "react"
import { MapPin, Star, Pencil, Trash2, Plus } from "lucide-react"
import { deleteAddress, setDefaultAddress } from "@/lib/actions/addresses"
import { AddressForm } from "./AddressForm"

interface AddressItem {
  id: string
  title: string
  fullAddress: string
  recipientName: string | null
  recipientPhone: string | null
  isDefault: boolean
}

interface Props {
  addresses: AddressItem[]
}

export function AddressList({ addresses }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleDelete(id: string) {
    if (!confirm("Удалить этот адрес?")) return
    startTransition(async () => {
      await deleteAddress(id)
    })
  }

  function handleSetDefault(id: string) {
    startTransition(async () => {
      await setDefaultAddress(id)
    })
  }

  return (
    <div className="space-y-4">
      {addresses.map((addr) =>
        editingId === addr.id ? (
          <AddressForm
            key={addr.id}
            address={addr}
            onDone={() => setEditingId(null)}
          />
        ) : (
          <div
            key={addr.id}
            className="bg-white rounded-xl border border-border p-4 flex items-start gap-3"
          >
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <MapPin className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-medium text-sm">{addr.title}</p>
                {addr.isDefault && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                    По умолчанию
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{addr.fullAddress}</p>
              {(addr.recipientName || addr.recipientPhone) && (
                <p className="text-xs text-muted-foreground mt-1">
                  {[addr.recipientName, addr.recipientPhone].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {!addr.isDefault && (
                <button
                  onClick={() => handleSetDefault(addr.id)}
                  disabled={isPending}
                  className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                  title="Сделать по умолчанию"
                >
                  <Star className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setEditingId(addr.id)}
                className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                title="Редактировать"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(addr.id)}
                disabled={isPending}
                className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-muted-foreground hover:text-red-500 transition-colors"
                title="Удалить"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )
      )}

      {showForm ? (
        <AddressForm onDone={() => setShowForm(false)} />
      ) : (
        addresses.length < 5 && (
          <button
            onClick={() => setShowForm(true)}
            className="w-full h-12 rounded-xl border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Добавить адрес
          </button>
        )
      )}
    </div>
  )
}
