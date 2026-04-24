"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  approveWholesaleOrder,
  rejectWholesaleOrder,
  markWholesaleOrderPaid,
} from "@/lib/actions/wholesale-orders"

interface Props {
  orderId: string
  orderNumber: string
  total: number
  approvalStatus: string | null
  paymentStatus: string | null
  paymentTerms: string | null
  wholesaleCompanyId: string | null
  b2bLegalName: string | null
  b2bInn: string | null
  b2bKpp: string | null
}

export function WholesaleOrderPanel(props: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<null | "approve" | "reject" | "paid">(null)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [error, setError] = useState("")

  async function handleApprove() {
    if (!confirm("Одобрить заказ к отгрузке?")) return
    setLoading("approve")
    setError("")
    try {
      await approveWholesaleOrder(props.orderId)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка")
    } finally {
      setLoading(null)
    }
  }

  async function handleReject(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading("reject")
    const form = new FormData(e.currentTarget)
    try {
      await rejectWholesaleOrder(props.orderId, String(form.get("reason") || ""))
      router.refresh()
      setRejectOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка")
    } finally {
      setLoading(null)
    }
  }

  async function handleMarkPaid() {
    if (!confirm(`Зафиксировать оплату ${props.total.toLocaleString("ru")}₽ по этому заказу?`)) return
    setLoading("paid")
    setError("")
    try {
      await markWholesaleOrderPaid(props.orderId)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка")
    } finally {
      setLoading(null)
    }
  }

  const isPending = props.approvalStatus === "pending_approval"
  const isNetTerms = props.paymentTerms && props.paymentTerms !== "prepay"
  const isPaid = props.paymentStatus === "succeeded"

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-amber-200">
      <h2 className="text-lg font-semibold mb-4">Оптовый заказ</h2>

      <div className="grid sm:grid-cols-2 gap-3 text-sm mb-4">
        <div>
          <div className="text-xs text-muted-foreground">Компания</div>
          <div className="font-medium">
            {props.wholesaleCompanyId ? (
              <Link
                href={`/admin/wholesale/companies/${props.wholesaleCompanyId}`}
                className="text-primary hover:underline"
              >
                {props.b2bLegalName ?? "—"}
              </Link>
            ) : (
              props.b2bLegalName ?? "—"
            )}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">ИНН / КПП</div>
          <div className="font-medium">
            {props.b2bInn ?? "—"}
            {props.b2bKpp ? ` / ${props.b2bKpp}` : ""}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Условия оплаты</div>
          <div className="font-medium">
            {props.paymentTerms === "prepay"
              ? "Предоплата"
              : `Отсрочка ${props.paymentTerms?.replace("net", "")} дн.`}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Статус апрува</div>
          <div className="font-medium">
            {props.approvalStatus === "pending_approval" ? (
              <span className="inline-flex rounded-full bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 text-xs">
                ждёт одобрения
              </span>
            ) : (
              props.approvalStatus ?? "не требуется (предоплата)"
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 mb-3">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {isPending && (
          <>
            <button
              onClick={handleApprove}
              disabled={loading !== null}
              className="rounded-lg bg-green-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {loading === "approve" ? "..." : "Одобрить к отгрузке"}
            </button>
            <button
              onClick={() => setRejectOpen((x) => !x)}
              className="rounded-lg border border-red-300 text-red-700 px-4 py-2 text-sm font-medium hover:bg-red-50"
            >
              Отклонить
            </button>
          </>
        )}
        {isNetTerms && !isPaid && !isPending && (
          <button
            onClick={handleMarkPaid}
            disabled={loading !== null}
            className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {loading === "paid" ? "..." : "Зафиксировать оплату"}
          </button>
        )}
        {isNetTerms && isPaid && (
          <span className="rounded-lg bg-green-50 text-green-700 border border-green-200 px-4 py-2 text-sm">
            Оплата зафиксирована
          </span>
        )}
      </div>

      {rejectOpen && (
        <form onSubmit={handleReject} className="mt-4 border-t pt-4 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Причина отклонения</label>
            <textarea
              name="reason"
              rows={2}
              required
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading !== null}
              className="rounded-lg bg-red-600 text-white px-4 py-2 text-sm font-medium"
            >
              {loading === "reject" ? "..." : "Подтвердить отклонение"}
            </button>
            <button
              type="button"
              onClick={() => setRejectOpen(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm"
            >
              Отмена
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
