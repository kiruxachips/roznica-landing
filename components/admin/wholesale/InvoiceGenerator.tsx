"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { generateInvoiceForOrder } from "@/lib/actions/wholesale-invoices"

interface Props {
  orderId: string
  existingInvoiceUrl: string | null
  existingInvoiceNumber: string | null
}

export function InvoiceGenerator({ orderId, existingInvoiceUrl, existingInvoiceNumber }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<"invoice" | "upd" | "act" | null>(null)
  const [error, setError] = useState("")

  async function handleGenerate(kind: "invoice" | "upd" | "act") {
    setLoading(kind)
    setError("")
    try {
      const vatEnv = process.env.NEXT_PUBLIC_DEFAULT_VAT_RATE
      const vatRate = vatEnv ? Number(vatEnv) : null
      await generateInvoiceForOrder(orderId, { kind, vatRate })
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка генерации")
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-border">
      <h2 className="text-lg font-semibold mb-3">Документы</h2>
      {error && (
        <div className="rounded bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 mb-3">
          {error}
        </div>
      )}
      {existingInvoiceUrl && (
        <div className="mb-3 text-sm">
          <a
            href={existingInvoiceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline font-medium"
          >
            Счёт {existingInvoiceNumber} — скачать PDF
          </a>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => handleGenerate("invoice")}
          disabled={loading !== null}
          className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {loading === "invoice" ? "..." : existingInvoiceUrl ? "Перегенерировать счёт" : "Сформировать счёт"}
        </button>
        <button
          onClick={() => handleGenerate("upd")}
          disabled={loading !== null}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          {loading === "upd" ? "..." : "УПД"}
        </button>
        <button
          onClick={() => handleGenerate("act")}
          disabled={loading !== null}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          {loading === "act" ? "..." : "Акт"}
        </button>
      </div>
    </div>
  )
}
