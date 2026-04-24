"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  updateWholesaleCompany,
  setWholesaleCompanyStatus,
} from "@/lib/actions/wholesale-companies"

interface Props {
  company: {
    id: string
    status: string
    legalName: string
    brandName: string | null
    kpp: string | null
    ogrn: string | null
    legalAddress: string | null
    postalAddress: string | null
    bankName: string | null
    bankBic: string | null
    bankAccount: string | null
    corrAccount: string | null
    contactName: string | null
    contactPhone: string | null
    contactEmail: string | null
    paymentTerms: string
    creditLimit: number
    priceListId: string | null
    managerAdminId: string | null
    notes: string | null
  }
  priceLists: { id: string; name: string }[]
  managers: { id: string; name: string }[]
}

export function CompanyEditPanel({ company, priceLists, managers }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError("")
    const form = new FormData(e.currentTarget)
    try {
      await updateWholesaleCompany(company.id, {
        brandName: (form.get("brandName") as string) || null,
        kpp: (form.get("kpp") as string) || null,
        ogrn: (form.get("ogrn") as string) || null,
        legalAddress: (form.get("legalAddress") as string) || null,
        postalAddress: (form.get("postalAddress") as string) || null,
        bankName: (form.get("bankName") as string) || null,
        bankBic: (form.get("bankBic") as string) || null,
        bankAccount: (form.get("bankAccount") as string) || null,
        corrAccount: (form.get("corrAccount") as string) || null,
        contactName: (form.get("contactName") as string) || null,
        contactPhone: (form.get("contactPhone") as string) || null,
        contactEmail: (form.get("contactEmail") as string) || null,
        priceListId: (form.get("priceListId") as string) || null,
        managerAdminId: (form.get("managerAdminId") as string) || null,
        notes: (form.get("notes") as string) || null,
      })
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить")
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(status: "active" | "suspended" | "rejected") {
    if (!confirm(`Изменить статус на "${status}"?`)) return
    try {
      await setWholesaleCompanyStatus(company.id, status)
      router.refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка")
    }
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold">Управление</h2>
          <div className="flex gap-2">
            {company.status !== "active" && (
              <button
                onClick={() => handleStatusChange("active")}
                className="text-sm rounded-lg bg-green-600 text-white px-3 py-1.5"
              >
                Активировать
              </button>
            )}
            {company.status === "active" && (
              <button
                onClick={() => handleStatusChange("suspended")}
                className="text-sm rounded-lg bg-amber-600 text-white px-3 py-1.5"
              >
                Приостановить
              </button>
            )}
            <button
              onClick={() => handleStatusChange("rejected")}
              className="text-sm rounded-lg border border-red-300 text-red-700 px-3 py-1.5 hover:bg-red-50"
            >
              Отклонить
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-xl shadow-sm p-5 space-y-4">
        <h2 className="font-semibold">Реквизиты и условия</h2>
        {error && (
          <div className="rounded bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
            {error}
          </div>
        )}
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Бренд-название" name="brandName" defaultValue={company.brandName ?? ""} />
          <Field label="КПП" name="kpp" defaultValue={company.kpp ?? ""} />
          <Field label="ОГРН" name="ogrn" defaultValue={company.ogrn ?? ""} />
          <Field label="Юрадрес" name="legalAddress" defaultValue={company.legalAddress ?? ""} />
          <Field label="Почтовый адрес" name="postalAddress" defaultValue={company.postalAddress ?? ""} />
          <Field label="Банк" name="bankName" defaultValue={company.bankName ?? ""} />
          <Field label="БИК" name="bankBic" defaultValue={company.bankBic ?? ""} />
          <Field label="Расчётный счёт" name="bankAccount" defaultValue={company.bankAccount ?? ""} />
          <Field label="Корр. счёт" name="corrAccount" defaultValue={company.corrAccount ?? ""} />
          <Field label="Контактное лицо" name="contactName" defaultValue={company.contactName ?? ""} />
          <Field label="Телефон" name="contactPhone" defaultValue={company.contactPhone ?? ""} />
          <Field label="Email" name="contactEmail" defaultValue={company.contactEmail ?? ""} />
          <div>
            <label className="block text-sm font-medium mb-1">Прайс-лист</label>
            <select
              name="priceListId"
              defaultValue={company.priceListId ?? ""}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            >
              <option value="">Розничный (не назначен)</option>
              {priceLists.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Ответственный менеджер</label>
            <select
              name="managerAdminId"
              defaultValue={company.managerAdminId ?? ""}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            >
              <option value="">— Не назначен —</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Заметки (CRM)</label>
            <textarea
              name="notes"
              defaultValue={company.notes ?? ""}
              rows={3}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-primary text-primary-foreground px-5 py-2 font-medium disabled:opacity-60"
        >
          {saving ? "Сохраняем..." : "Сохранить"}
        </button>
      </form>
    </div>
  )
}

function Field({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        name={name}
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-border px-3 py-2 text-sm"
      />
    </div>
  )
}
