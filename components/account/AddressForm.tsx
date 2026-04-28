"use client"

import { useState, useTransition } from "react"
import { createAddress, updateAddress } from "@/lib/actions/addresses"
import { PhoneInput } from "@/components/ui/phone-input"

interface AddressFormProps {
  address?: {
    id: string
    title: string
    fullAddress: string
    recipientName: string | null
    recipientPhone: string | null
    isDefault: boolean
  }
  onDone: () => void
}

export function AddressForm({ address, onDone }: AddressFormProps) {
  const [error, setError] = useState("")
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")

    const form = new FormData(e.currentTarget)
    const data = {
      title: form.get("title") as string,
      fullAddress: form.get("fullAddress") as string,
      recipientName: (form.get("recipientName") as string) || undefined,
      recipientPhone: (form.get("recipientPhone") as string) || undefined,
      isDefault: form.get("isDefault") === "on",
    }

    startTransition(async () => {
      const result = address
        ? await updateAddress(address.id, data)
        : await createAddress(data)

      if (result.error) {
        setError(result.error)
      } else {
        onDone()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-border p-5 space-y-4">
      <h3 className="font-semibold text-sm">
        {address ? "Редактировать адрес" : "Новый адрес"}
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Название *</label>
          <input
            name="title"
            required
            defaultValue={address?.title}
            placeholder="Дом, Работа..."
            autoCapitalize="words"
            enterKeyHint="next"
            className="w-full h-10 px-3 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Имя получателя</label>
          <input
            name="recipientName"
            defaultValue={address?.recipientName || ""}
            placeholder="Иван Иванов"
            autoComplete="name"
            autoCapitalize="words"
            enterKeyHint="next"
            className="w-full h-10 px-3 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Адрес *</label>
        <textarea
          name="fullAddress"
          required
          rows={2}
          defaultValue={address?.fullAddress}
          placeholder="Город, улица, дом, квартира"
          autoComplete="street-address"
          enterKeyHint="next"
          className="w-full px-3 py-2 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Телефон получателя</label>
          <PhoneInput
            name="recipientPhone"
            defaultValue={address?.recipientPhone || ""}
            className="w-full h-10 px-3 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 cursor-pointer h-10">
            <input
              type="checkbox"
              name="isDefault"
              defaultChecked={address?.isDefault}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            <span className="text-sm">Адрес по умолчанию</span>
          </label>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="h-9 px-5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isPending ? "Сохранение..." : "Сохранить"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="h-9 px-5 bg-muted text-muted-foreground rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors"
        >
          Отмена
        </button>
      </div>
    </form>
  )
}
