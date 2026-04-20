"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, Ban, Trash2, UserCog, X } from "lucide-react"
import {
  approveUser,
  blockUser,
  unblockUser,
  changeUserRole,
  deleteUser,
  rejectPendingUser,
} from "./actions"

interface User {
  id: string
  email: string
  name: string
  role: string
  status: string
  createdAt: string
  updatedAt: string
}

interface Props {
  users: User[]
  currentUserId: string
}

export function UsersManager({ users, currentUserId }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")

  function run<T>(fn: () => Promise<T>, confirmMsg?: string) {
    if (confirmMsg && !confirm(confirmMsg)) return
    setError("")
    startTransition(async () => {
      try {
        await fn()
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка")
      }
    })
  }

  const pendingUsers = users.filter((u) => u.status === "pending")
  const activeUsers = users.filter((u) => u.status === "active")
  const blockedUsers = users.filter((u) => u.status === "blocked")

  return (
    <div className="space-y-6">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg border border-red-100">
          {error}
        </div>
      )}

      {pendingUsers.length > 0 && (
        <Section title="Ожидают одобрения" count={pendingUsers.length} highlight>
          <UserTable
            users={pendingUsers}
            currentUserId={currentUserId}
            pending={pending}
            renderActions={(u) => (
              <>
                <button
                  onClick={() => run(() => approveUser(u.id))}
                  disabled={pending}
                  className="inline-flex items-center gap-1 text-sm text-green-700 hover:text-green-800 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" /> Одобрить
                </button>
                <button
                  onClick={() =>
                    run(() => rejectPendingUser(u.id), `Отклонить заявку ${u.email}? Пользователь будет удалён.`)
                  }
                  disabled={pending}
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-red-700 disabled:opacity-50"
                >
                  <X className="w-4 h-4" /> Отклонить
                </button>
              </>
            )}
          />
        </Section>
      )}

      <Section title="Активные" count={activeUsers.length}>
        <UserTable
          users={activeUsers}
          currentUserId={currentUserId}
          pending={pending}
          renderActions={(u) => (
            <>
              <RoleSelector
                current={u.role}
                disabled={pending || u.id === currentUserId}
                onChange={(role) => run(() => changeUserRole(u.id, role))}
              />
              {u.id !== currentUserId && (
                <button
                  onClick={() => run(() => blockUser(u.id), `Заблокировать ${u.email}?`)}
                  disabled={pending}
                  className="inline-flex items-center gap-1 text-sm text-amber-700 hover:text-amber-800 disabled:opacity-50"
                >
                  <Ban className="w-4 h-4" /> Блокировать
                </button>
              )}
              {u.id !== currentUserId && (
                <button
                  onClick={() => run(() => deleteUser(u.id), `Удалить ${u.email} навсегда?`)}
                  disabled={pending}
                  className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" /> Удалить
                </button>
              )}
            </>
          )}
        />
      </Section>

      {blockedUsers.length > 0 && (
        <Section title="Заблокированные" count={blockedUsers.length}>
          <UserTable
            users={blockedUsers}
            currentUserId={currentUserId}
            pending={pending}
            renderActions={(u) => (
              <>
                <button
                  onClick={() => run(() => unblockUser(u.id))}
                  disabled={pending}
                  className="inline-flex items-center gap-1 text-sm text-green-700 hover:text-green-800 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" /> Разблокировать
                </button>
                <button
                  onClick={() => run(() => deleteUser(u.id), `Удалить ${u.email} навсегда?`)}
                  disabled={pending}
                  className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" /> Удалить
                </button>
              </>
            )}
          />
        </Section>
      )}
    </div>
  )
}

function Section({
  title,
  count,
  highlight,
  children,
}: {
  title: string
  count: number
  highlight?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={`bg-white rounded-xl border ${highlight ? "border-amber-200 ring-2 ring-amber-50" : "border-border"} shadow-sm overflow-hidden`}
    >
      <div className="px-5 py-3 border-b border-border flex items-center gap-2">
        <h2 className="font-semibold">{title}</h2>
        <span className="text-sm text-muted-foreground">({count})</span>
      </div>
      {children}
    </div>
  )
}

function UserTable({
  users,
  currentUserId,
  pending,
  renderActions,
}: {
  users: User[]
  currentUserId: string
  pending: boolean
  renderActions: (u: User) => React.ReactNode
}) {
  if (users.length === 0) {
    return <div className="px-5 py-6 text-sm text-muted-foreground">Никого</div>
  }
  return (
    <table className="w-full text-sm">
      <thead className="bg-muted/40 text-muted-foreground">
        <tr>
          <th className="text-left px-5 py-2 font-medium">Имя</th>
          <th className="text-left px-5 py-2 font-medium">Email</th>
          <th className="text-left px-5 py-2 font-medium">Роль</th>
          <th className="text-left px-5 py-2 font-medium">Создан</th>
          <th className="text-right px-5 py-2 font-medium">Действия</th>
        </tr>
      </thead>
      <tbody>
        {users.map((u) => (
          <tr key={u.id} className="border-t border-border hover:bg-muted/20">
            <td className="px-5 py-3">
              {u.name}
              {u.id === currentUserId && (
                <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">вы</span>
              )}
            </td>
            <td className="px-5 py-3 text-muted-foreground">{u.email}</td>
            <td className="px-5 py-3">
              <RoleBadge role={u.role} />
            </td>
            <td className="px-5 py-3 text-xs text-muted-foreground">
              {new Date(u.createdAt).toLocaleDateString("ru-RU")}
            </td>
            <td className="px-5 py-3 text-right">
              <div className="inline-flex flex-wrap gap-3 justify-end">
                <fieldset disabled={pending}>{renderActions(u)}</fieldset>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function RoleBadge({ role }: { role: string }) {
  if (role === "admin") {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-medium">
        Админ
      </span>
    )
  }
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
      Менеджер
    </span>
  )
}

function RoleSelector({
  current,
  disabled,
  onChange,
}: {
  current: string
  disabled: boolean
  onChange: (role: "admin" | "manager") => void
}) {
  return (
    <label className="inline-flex items-center gap-1 text-sm text-muted-foreground">
      <UserCog className="w-4 h-4" />
      <select
        value={current}
        disabled={disabled}
        onChange={(e) => {
          const next = e.target.value as "admin" | "manager"
          if (next !== current) {
            if (confirm(`Сменить роль на "${next}"?`)) {
              onChange(next)
            } else {
              // откатываем значение в DOM (если менеджер подтверждения нажал «отмена»)
              e.target.value = current
            }
          }
        }}
        className="h-7 px-2 rounded border border-input text-xs bg-white disabled:opacity-50"
      >
        <option value="manager">Менеджер</option>
        <option value="admin">Админ</option>
      </select>
    </label>
  )
}
