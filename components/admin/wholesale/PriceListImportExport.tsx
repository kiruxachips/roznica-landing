"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  exportPriceListXlsx,
  importPriceListCsv,
} from "@/lib/actions/wholesale-price-import-export"

export function PriceListImportExport({ priceListId }: { priceListId: string }) {
  const router = useRouter()
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [report, setReport] = useState<{
    created: number
    updated: number
    errors: { line: number; reason: string }[]
  } | null>(null)
  const [error, setError] = useState("")

  async function handleExport() {
    setExporting(true)
    setError("")
    try {
      const { base64, filename } = await exportPriceListXlsx(priceListId)
      const blob = new Blob(
        [Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))],
        {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }
      )
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка экспорта")
    } finally {
      setExporting(false)
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setError("")
    setReport(null)
    try {
      const text = await file.text()
      const result = await importPriceListCsv(priceListId, text)
      setReport(result)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка импорта")
    } finally {
      setImporting(false)
      e.target.value = ""
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <h2 className="font-semibold mb-3">Импорт / экспорт</h2>
      {error && (
        <div className="rounded bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 mb-3">
          {error}
        </div>
      )}
      {report && (
        <div className="rounded bg-blue-50 border border-blue-200 text-blue-900 text-sm px-3 py-2 mb-3">
          Импортировано: <strong>создано {report.created}</strong>, обновлено{" "}
          <strong>{report.updated}</strong>
          {report.errors.length > 0 && (
            <>
              . Ошибок: <strong>{report.errors.length}</strong>
              <ul className="mt-1 text-xs list-disc pl-5">
                {report.errors.slice(0, 10).map((e, i) => (
                  <li key={i}>
                    строка {e.line}: {e.reason}
                  </li>
                ))}
                {report.errors.length > 10 && (
                  <li>...и ещё {report.errors.length - 10}</li>
                )}
              </ul>
            </>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2 items-center">
        <button
          onClick={handleExport}
          disabled={exporting}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
        >
          {exporting ? "Экспортируем..." : "Экспорт в XLSX"}
        </button>
        <label
          className={`rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium cursor-pointer ${
            importing ? "opacity-60" : "hover:bg-primary/90"
          }`}
        >
          {importing ? "Импортируем..." : "Импорт CSV"}
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleImport}
            disabled={importing}
            className="hidden"
          />
        </label>
        <span className="text-xs text-muted-foreground">
          CSV: столбцы <code>variantId</code> или <code>sku</code>, <code>price</code>, <code>minQuantity</code>
        </span>
      </div>
    </div>
  )
}
