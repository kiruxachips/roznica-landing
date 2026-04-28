"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  inviteWholesaleMember,
  revokeWholesaleInvitation,
  removeWholesaleMember,
} from "@/lib/actions/wholesale-members"

interface User {
  id: string
  email: string
  name: string
  role: string
  status: string
  lastLoginAt: Date | null
}

interface Invitation {
  id: string
  email: string
  role: string
  expiresAt: Date
  createdAt: Date
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Владелец",
  buyer: "Закупщик",
  accountant: "Бухгалтер",
}

export function TeamManagement(props: {
  isOwner: boolean
  users: User[]
  invitations: Invitation[]
  currentUserId: string
}) {
  const router = useRouter()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const form = new FormData(e.currentTarget)
    try {
      await inviteWholesaleMember({
        email: String(form.get("email") || ""),
        name: String(form.get("name") || ""),
        role: form.get("role") as "buyer" | "accountant",
      })
      setInviteOpen(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка")
    } finally {
      setLoading(false)
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm("Отозвать приглашение?")) return
    try {
      await revokeWholesaleInvitation(id)
      router.refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка")
    }
  }

  async function handleRemove(id: string) {
    if (!confirm("Заблокировать сотрудника?")) return
    try {
      await removeWholesaleMember(id)
      router.refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка")
    }
  }

  return (
    <div className="space-y-5">
      <section className="bg-white rounded-2xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Сотрудники ({props.users.length})</h2>
          {props.isOwner && (
            <button
              onClick={() => setInviteOpen((x) => !x)}
              className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium"
            >
              + Пригласить
            </button>
          )}
        </div>

        {inviteOpen && (
          <form onSubmit={handleInvite} className="mb-4 bg-secondary/30 rounded-xl p-4 space-y-3">
            {error && (
              <div className="rounded bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
                {error}
              </div>
            )}
            <div className="grid sm:grid-cols-3 gap-3">
              <input
                name="name"
                required
                placeholder="Имя"
                autoComplete="name"
                autoCapitalize="words"
                enterKeyHint="next"
                className="rounded-lg border border-border px-3 py-2 text-sm"
              />
              <input
                name="email"
                required
                type="email"
                placeholder="email"
                autoComplete="email"
                inputMode="email"
                enterKeyHint="next"
                className="rounded-lg border border-border px-3 py-2 text-sm"
              />
              <select
                name="role"
                className="rounded-lg border border-border px-3 py-2 text-sm"
              >
                <option value="buyer">Закупщик</option>
                <option value="accountant">Бухгалтер</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium"
              >
                {loading ? "..." : "Отправить приглашение"}
              </button>
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm"
              >
                Отмена
              </button>
            </div>
          </form>
        )}

        <ul className="divide-y text-sm">
          {props.users.map((u) => (
            <li key={u.id} className="py-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium">
                  {u.name}
                  {u.id === props.currentUserId && (
                    <span className="ml-2 text-xs text-muted-foreground">(вы)</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {u.email} · {ROLE_LABELS[u.role] ?? u.role} ·{" "}
                  <span
                    className={
                      u.status === "active"
                        ? "text-green-700"
                        : u.status === "pending"
                          ? "text-amber-700"
                          : "text-red-700"
                    }
                  >
                    {u.status === "pending"
                      ? "ожидает активации"
                      : u.status === "blocked"
                        ? "заблокирован"
                        : "активен"}
                  </span>
                </div>
                {u.lastLoginAt && (
                  <div className="text-xs text-muted-foreground">
                    последний вход: {new Date(u.lastLoginAt).toLocaleString("ru")}
                  </div>
                )}
              </div>
              {props.isOwner && u.id !== props.currentUserId && u.role !== "owner" && u.status !== "blocked" && (
                <button
                  onClick={() => handleRemove(u.id)}
                  className="text-xs font-medium text-red-600 hover:bg-red-50 rounded-md px-2.5 py-2 min-h-[40px] shrink-0 border border-transparent hover:border-red-200 transition-colors"
                >
                  Заблокировать
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {props.invitations.length > 0 && (
        <section className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-semibold mb-3">Активные приглашения</h2>
          <ul className="divide-y text-sm">
            {props.invitations.map((inv) => (
              <li key={inv.id} className="py-2 flex items-center justify-between gap-2">
                <div>
                  <div className="font-medium">{inv.email}</div>
                  <div className="text-xs text-muted-foreground">
                    {ROLE_LABELS[inv.role] ?? inv.role} · действителен до{" "}
                    {new Date(inv.expiresAt).toLocaleDateString("ru")}
                  </div>
                </div>
                {props.isOwner && (
                  <button
                    onClick={() => handleRevoke(inv.id)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    отозвать
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
