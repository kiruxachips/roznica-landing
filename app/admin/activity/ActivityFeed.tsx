"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

interface LogEntry {
  id: string
  adminUserId: string | null
  adminName: string | null
  adminRole: string | null
  action: string
  entityType: string | null
  entityId: string | null
  payload: unknown
  createdAt: string
}

interface Admin {
  id: string
  name: string
  email: string
  role: string
}

interface Props {
  logs: LogEntry[]
  admins: Admin[]
  initialFilters: { user?: string; action?: string; entity?: string }
}

const ACTION_LABELS: Record<string, string> = {
  "order.status_changed": "Смена статуса заказа",
  "order.cancelled": "Отмена заказа",
  "order.notes_updated": "Правка заметок заказа",
  "order.shipment_created": "Создание отправки",
  "order.tracking_refreshed": "Обновление трекинга",
  "stock.adjusted": "Коррекция остатка",
  "stock.bulk_intake": "Массовый приход",
  "stock.threshold_set": "Смена порога остатка",
  "product.created": "Создание товара",
  "product.updated": "Редактирование товара",
  "product.deleted": "Удаление товара",
  "product.toggleActive": "Смена активности товара",
  "variant.created": "Создание варианта",
  "variant.updated": "Редактирование варианта",
  "variant.deleted": "Удаление варианта",
  "category.created": "Создание категории",
  "category.updated": "Редактирование категории",
  "category.deleted": "Удаление категории",
  "collection.created": "Создание подборки",
  "collection.updated": "Редактирование подборки",
  "collection.deleted": "Удаление подборки",
  "review.toggle_visibility": "Видимость отзыва",
  "review.deleted": "Удаление отзыва",
  "promo.created": "Создание промокода",
  "promo.updated": "Редактирование промокода",
  "promo.deleted": "Удаление промокода",
  "promo.toggle_active": "Переключение промокода",
  "article.created": "Создание статьи",
  "article.updated": "Редактирование статьи",
  "article.deleted": "Удаление статьи",
  "article.toggle_published": "Публикация статьи",
  "article_category.created": "Создание рубрики блога",
  "article_category.updated": "Редактирование рубрики блога",
  "article_category.deleted": "Удаление рубрики блога",
  "delivery.settings_updated": "Настройки доставки",
  "delivery.markup_created": "Создание наценки",
  "delivery.markup_updated": "Редактирование наценки",
  "delivery.markup_deleted": "Удаление наценки",
  "delivery.rule_created": "Создание правила доставки",
  "delivery.rule_updated": "Редактирование правила доставки",
  "delivery.rule_deleted": "Удаление правила доставки",
  "delivery.rule_toggled": "Переключение правила доставки",
  "user.approved": "Одобрение пользователя",
  "user.blocked": "Блокировка пользователя",
  "user.unblocked": "Разблокировка пользователя",
  "user.role_changed": "Смена роли",
  "user.deleted": "Удаление пользователя",
  "user.rejected": "Отклонение заявки",
}

export function ActivityFeed({ logs, admins, initialFilters }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [user, setUser] = useState(initialFilters.user || "")
  const [action, setAction] = useState(initialFilters.action || "")
  const [entity, setEntity] = useState(initialFilters.entity || "")
  const [expanded, setExpanded] = useState<string | null>(null)

  function apply() {
    const sp = new URLSearchParams()
    if (user) sp.set("user", user)
    if (action) sp.set("action", action)
    if (entity) sp.set("entity", entity)
    startTransition(() => router.push(`/admin/activity?${sp.toString()}`))
  }

  function reset() {
    setUser("")
    setAction("")
    setEntity("")
    startTransition(() => router.push("/admin/activity"))
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-border p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Пользователь</label>
          <select
            value={user}
            onChange={(e) => setUser(e.target.value)}
            className="h-9 px-2 rounded border border-input text-sm min-w-[180px]"
          >
            <option value="">Все</option>
            {admins.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.role})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Действие (подстрока)</label>
          <input
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="order, stock, delivery..."
            className="h-9 px-2 rounded border border-input text-sm w-44"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Тип объекта</label>
          <select
            value={entity}
            onChange={(e) => setEntity(e.target.value)}
            className="h-9 px-2 rounded border border-input text-sm"
          >
            <option value="">Все</option>
            <option value="order">Заказ</option>
            <option value="variant">Вариант</option>
            <option value="product">Товар</option>
            <option value="category">Категория</option>
            <option value="collection">Подборка</option>
            <option value="review">Отзыв</option>
            <option value="promo_code">Промокод</option>
            <option value="article">Статья</option>
            <option value="delivery_rule">Правило доставки</option>
            <option value="markup_rule">Наценка</option>
            <option value="delivery_setting">Настройки доставки</option>
            <option value="admin_user">Пользователь</option>
          </select>
        </div>
        <button
          onClick={apply}
          className="h-9 px-4 rounded bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
        >
          Применить
        </button>
        <button
          onClick={reset}
          className="h-9 px-4 rounded border border-border text-sm hover:bg-muted"
        >
          Сбросить
        </button>
      </div>

      <div className="bg-white rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Время</th>
              <th className="text-left px-4 py-2 font-medium">Пользователь</th>
              <th className="text-left px-4 py-2 font-medium">Действие</th>
              <th className="text-left px-4 py-2 font-medium">Объект</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  Пусто
                </td>
              </tr>
            )}
            {logs.map((l) => {
              const isOpen = expanded === l.id
              const actionLabel = ACTION_LABELS[l.action] || l.action
              return (
                <>
                  <tr
                    key={l.id}
                    className="border-t border-border hover:bg-muted/20 cursor-pointer"
                    onClick={() => setExpanded(isOpen ? null : l.id)}
                  >
                    <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(l.createdAt).toLocaleString("ru-RU")}
                    </td>
                    <td className="px-4 py-2">
                      {l.adminName || <span className="text-muted-foreground italic">удалён</span>}
                      {l.adminRole && (
                        <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {l.adminRole === "admin" ? "админ" : "менеджер"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <span className="font-medium">{actionLabel}</span>
                      <span className="ml-2 text-xs text-muted-foreground font-mono">{l.action}</span>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {l.entityType}{l.entityId ? ` · ${l.entityId.slice(0, 8)}…` : ""}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{isOpen ? "▼" : "▶"}</td>
                  </tr>
                  {isOpen && l.payload !== null && (
                    <tr className="border-t border-border bg-muted/10">
                      <td colSpan={5} className="px-6 py-4">
                        <pre className="text-[11px] leading-relaxed bg-white border border-border rounded p-3 overflow-x-auto">
                          {JSON.stringify(l.payload, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
