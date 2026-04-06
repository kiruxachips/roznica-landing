"use client"

import { useState, useTransition } from "react"
import type { DeliveryRule } from "@prisma/client"
import { createDeliveryRule, deleteDeliveryRule, toggleDeliveryRule } from "@/lib/actions/delivery-rules"

const carrierLabels: Record<string, string> = {
  all: "Все службы",
  pochta: "Почта России",
  cdek: "СДЭК",
  courier: "Курьер",
}

const deliveryTypeLabels: Record<string, string> = {
  pvz: "Самовывоз (ПВЗ)",
  door: "До двери",
}

const actionLabels: Record<string, string> = {
  free: "Бесплатная доставка",
  discount: "Скидка на доставку",
  disable: "Отключить службу",
}

function RuleConditions({ rule }: { rule: DeliveryRule }) {
  const parts: string[] = []
  if (rule.minCartTotal) parts.push(`сумма ≥ ${rule.minCartTotal}₽`)
  if (rule.deliveryType) parts.push(`тип = ${deliveryTypeLabels[rule.deliveryType] || rule.deliveryType}`)
  if (rule.maxDeliveryPrice) parts.push(`стоимость доставки < ${rule.maxDeliveryPrice}₽`)
  if (rule.city) parts.push(`город = ${rule.city}`)
  if (parts.length === 0) return <span className="text-muted-foreground text-xs">Без условий</span>
  return <span className="text-xs text-muted-foreground">{parts.join(" И ")}</span>
}

function RuleAction({ rule }: { rule: DeliveryRule }) {
  if (rule.action === "free") return <span className="text-green-700 font-medium text-sm">→ Бесплатно</span>
  if (rule.action === "discount") return <span className="text-blue-700 font-medium text-sm">→ Скидка {rule.discountAmount}₽</span>
  if (rule.action === "disable") return <span className="text-red-700 font-medium text-sm">→ Отключить</span>
  return null
}

export function DeliveryRulesManager({ initialRules }: { initialRules: DeliveryRule[] }) {
  const [rules, setRules] = useState(initialRules)
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Form state
  const [name, setName] = useState("")
  const [carrier, setCarrier] = useState("pochta")
  const [deliveryType, setDeliveryType] = useState("")
  const [minCartTotal, setMinCartTotal] = useState("")
  const [maxDeliveryPrice, setMaxDeliveryPrice] = useState("")
  const [city, setCity] = useState("")
  const [action, setAction] = useState("free")
  const [discountAmount, setDiscountAmount] = useState("")

  function resetForm() {
    setName("")
    setCarrier("pochta")
    setDeliveryType("")
    setMinCartTotal("")
    setMaxDeliveryPrice("")
    setCity("")
    setAction("free")
    setDiscountAmount("")
    setShowForm(false)
  }

  function handleCreate() {
    if (!name.trim()) return
    startTransition(async () => {
      await createDeliveryRule({
        name: name.trim(),
        carrier,
        deliveryType: deliveryType || undefined,
        minCartTotal: minCartTotal ? parseInt(minCartTotal) : undefined,
        maxDeliveryPrice: maxDeliveryPrice ? parseInt(maxDeliveryPrice) : undefined,
        city: city.trim() || undefined,
        action,
        discountAmount: discountAmount ? parseInt(discountAmount) : undefined,
      })
      // Optimistic: add to local list
      setRules((prev) => [
        ...prev,
        {
          id: `temp-${Date.now()}`,
          name: name.trim(),
          carrier,
          deliveryType: deliveryType || null,
          minCartTotal: minCartTotal ? parseInt(minCartTotal) : null,
          maxDeliveryPrice: maxDeliveryPrice ? parseInt(maxDeliveryPrice) : null,
          city: city.trim() || null,
          action,
          discountAmount: discountAmount ? parseInt(discountAmount) : null,
          isActive: true,
          sortOrder: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])
      resetForm()
    })
  }

  function handleToggle(id: string, current: boolean) {
    startTransition(async () => {
      await toggleDeliveryRule(id, !current)
      setRules((prev) => prev.map((r) => (r.id === id ? { ...r, isActive: !current } : r)))
    })
  }

  function handleDelete(id: string) {
    if (!confirm("Удалить правило?")) return
    startTransition(async () => {
      await deleteDeliveryRule(id)
      setRules((prev) => prev.filter((r) => r.id !== id))
    })
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-border">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Правила доставки</h2>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          {showForm ? "Отмена" : "Добавить правило"}
        </button>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Условные правила для бесплатной доставки, скидок и ограничений. Правила проверяются по порядку.
      </p>

      {showForm && (
        <div className="border border-border rounded-lg p-4 mb-4 space-y-3 bg-muted/30">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-sm font-medium mb-1 block">Название</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Бесплатная доставка от 3000₽"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Служба доставки</label>
              <select value={carrier} onChange={(e) => setCarrier(e.target.value)} className="w-full px-3 py-2 text-sm border border-border rounded-lg">
                {Object.entries(carrierLabels).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Тип доставки</label>
              <select value={deliveryType} onChange={(e) => setDeliveryType(e.target.value)} className="w-full px-3 py-2 text-sm border border-border rounded-lg">
                <option value="">Любой</option>
                <option value="pvz">Самовывоз (ПВЗ)</option>
                <option value="door">До двери</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Действие</label>
              <select value={action} onChange={(e) => setAction(e.target.value)} className="w-full px-3 py-2 text-sm border border-border rounded-lg">
                {Object.entries(actionLabels).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            {action === "discount" && (
              <div>
                <label className="text-sm font-medium mb-1 block">Скидка (₽)</label>
                <input
                  type="number"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  placeholder="100"
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg"
                />
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-1 block">Мин. сумма корзины (₽)</label>
              <input
                type="number"
                value={minCartTotal}
                onChange={(e) => setMinCartTotal(e.target.value)}
                placeholder="3000"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Макс. стоимость доставки (₽)</label>
              <input
                type="number"
                value={maxDeliveryPrice}
                onChange={(e) => setMaxDeliveryPrice(e.target.value)}
                placeholder="750"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg"
              />
            </div>

            <div className="col-span-2">
              <label className="text-sm font-medium mb-1 block">Город (точное совпадение, пусто = все)</label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Калининград"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleCreate}
            disabled={isPending || !name.trim()}
            className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isPending ? "Сохраняю..." : "Создать правило"}
          </button>
        </div>
      )}

      {rules.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Нет правил. Добавьте первое правило.</p>
      ) : (
        <div className="divide-y divide-border">
          {rules.map((rule) => (
            <div key={rule.id} className={`py-3 flex items-start justify-between gap-4 ${!rule.isActive ? "opacity-50" : ""}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">{rule.name}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground">
                    {carrierLabels[rule.carrier] || rule.carrier}
                  </span>
                  <RuleAction rule={rule} />
                </div>
                <RuleConditions rule={rule} />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleToggle(rule.id, rule.isActive)}
                  disabled={isPending}
                  className={`text-xs px-2 py-1 rounded ${rule.isActive ? "text-green-700 bg-green-50" : "text-muted-foreground bg-muted"}`}
                >
                  {rule.isActive ? "Вкл" : "Выкл"}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(rule.id)}
                  disabled={isPending}
                  className="text-xs px-2 py-1 rounded text-red-600 bg-red-50 hover:bg-red-100"
                >
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
