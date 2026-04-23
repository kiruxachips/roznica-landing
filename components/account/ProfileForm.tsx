"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { User as UserIcon } from "lucide-react"
import { updateProfile, changePassword } from "@/lib/actions/profile"
import { PhoneInput } from "@/components/ui/phone-input"

interface ProfileFormProps {
  user: {
    name: string | null
    email: string | null
    phone: string | null
    defaultAddress: string | null
    avatarUrl: string | null
    passwordHash: boolean // has password
    accounts: { provider: string }[]
  }
}

export function ProfileForm({ user }: ProfileFormProps) {
  const router = useRouter()
  const [profileMsg, setProfileMsg] = useState("")
  const [profileError, setProfileError] = useState("")
  const [passwordMsg, setPasswordMsg] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [loadingPassword, setLoadingPassword] = useState(false)
  // R6: флаг "форма изменена, но не сохранена". Включается при любом onChange
  // в inputs формы профиля, сбрасывается после успешного save.
  const [profileDirty, setProfileDirty] = useState(false)

  // R6: browser-level warning при попытке уйти со страницы (reload,
  // закрыть таб, navigate-away в адресной строке) с несохранёнными изменениями.
  // Next-link клики перехватить надёжно можно только через router.events,
  // которого в app-router нет; делегируем visual-индикатору кнопки "Сохранить".
  useEffect(() => {
    if (!profileDirty) return
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
      // Современные браузеры игнорируют текст returnValue и показывают свой
      // стандартный диалог, но поле нужно установить для Legacy-совместимости.
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [profileDirty])

  function markDirty() {
    if (!profileDirty) setProfileDirty(true)
    // Чистим старые сообщения, чтобы не вводили в заблуждение
    if (profileMsg) setProfileMsg("")
  }

  async function handleProfileSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setProfileMsg("")
    setProfileError("")
    setLoadingProfile(true)

    const form = new FormData(e.currentTarget)
    const result = await updateProfile({
      name: form.get("name") as string,
      phone: form.get("phone") as string,
      defaultAddress: form.get("defaultAddress") as string,
      email: user.email ? undefined : (form.get("email") as string),
    })

    setLoadingProfile(false)

    if (result.error) {
      setProfileError(result.error)
    } else {
      setProfileMsg("Профиль сохранён")
      setProfileDirty(false)
      router.refresh()
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPasswordMsg("")
    setPasswordError("")
    setLoadingPassword(true)

    const form = new FormData(e.currentTarget)
    const newPassword = form.get("newPassword") as string
    const confirm = form.get("confirmPassword") as string

    if (newPassword !== confirm) {
      setPasswordError("Пароли не совпадают")
      setLoadingPassword(false)
      return
    }

    if (newPassword.length < 6) {
      setPasswordError("Пароль должен быть не менее 6 символов")
      setLoadingPassword(false)
      return
    }

    const result = await changePassword({
      currentPassword: (form.get("currentPassword") as string) || undefined,
      newPassword,
    })

    setLoadingPassword(false)

    if (result.error) {
      setPasswordError(result.error)
    } else {
      setPasswordMsg("Пароль изменён")
      ;(e.target as HTMLFormElement).reset()
    }
  }

  const providerNames: Record<string, string> = {
    google: "Google",
    yandex: "Яндекс",
    vk: "VK",
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Profile info */}
      <form onSubmit={handleProfileSubmit} onChange={markDirty} className="bg-white rounded-2xl shadow-sm p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full overflow-hidden bg-muted flex items-center justify-center shrink-0">
            {user.avatarUrl ? (
              <Image
                src={user.avatarUrl}
                alt={user.name || "Аватар"}
                width={64}
                height={64}
                className="w-16 h-16 object-cover"
                unoptimized
              />
            ) : (
              <UserIcon className="w-7 h-7 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">Личные данные</h2>
            <p className="text-xs text-muted-foreground">
              {user.name || "Имя не указано"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Имя</label>
            <input
              name="name"
              defaultValue={user.name || ""}
              className="w-full h-11 px-4 rounded-xl border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Телефон</label>
            <PhoneInput
              name="phone"
              defaultValue={user.phone || ""}
              className="w-full h-11 px-4 rounded-xl border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          {user.email ? (
            <input
              value={user.email}
              readOnly
              className="w-full h-11 px-4 rounded-xl border border-input text-sm bg-muted/50 text-muted-foreground"
            />
          ) : (
            <>
              <input
                name="email"
                type="email"
                placeholder="you@example.com"
                className="w-full h-11 px-4 rounded-xl border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Укажите email — он нужен для отправки уведомлений о статусе заказа
              </p>
            </>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Адрес доставки по умолчанию</label>
          <textarea
            name="defaultAddress"
            rows={2}
            defaultValue={user.defaultAddress || ""}
            className="w-full px-4 py-3 rounded-xl border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Город, улица, дом, квартира"
          />
        </div>

        {profileError && (
          <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{profileError}</p>
        )}
        {profileMsg && (
          <p className="text-sm text-green-600 bg-green-50 rounded-xl px-4 py-3">{profileMsg}</p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={loadingProfile}
            className="h-11 px-6 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loadingProfile ? "Сохранение..." : "Сохранить"}
          </button>
          {profileDirty && !loadingProfile && (
            <span className="text-xs text-amber-700 flex items-center gap-1.5">
              <span className="w-2 h-2 bg-amber-500 rounded-full inline-block animate-pulse" />
              Есть несохранённые изменения
            </span>
          )}
        </div>
      </form>

      {/* Connected accounts */}
      {user.accounts.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-6">
          <h2 className="text-lg font-semibold mb-3">Связанные аккаунты</h2>
          <div className="space-y-2">
            {user.accounts.map((acc) => (
              <div key={acc.provider} className="flex items-center gap-3 px-4 py-2.5 bg-muted/50 rounded-xl text-sm">
                <span className="font-medium">{providerNames[acc.provider] || acc.provider}</span>
                <span className="text-green-600 text-xs">Подключён</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Change password */}
      <form onSubmit={handlePasswordSubmit} className="bg-white rounded-2xl shadow-sm p-4 sm:p-6 space-y-4">
        <h2 className="text-lg font-semibold">
          {user.passwordHash ? "Изменить пароль" : "Установить пароль"}
        </h2>

        {user.passwordHash && (
          <div>
            <label className="block text-sm font-medium mb-1">Текущий пароль</label>
            <input
              name="currentPassword"
              type="password"
              className="w-full h-11 px-4 rounded-xl border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Новый пароль</label>
          <input
            name="newPassword"
            type="password"
            required
            minLength={6}
            className="w-full h-11 px-4 rounded-xl border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Подтвердите пароль</label>
          <input
            name="confirmPassword"
            type="password"
            required
            minLength={6}
            className="w-full h-11 px-4 rounded-xl border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {passwordError && (
          <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{passwordError}</p>
        )}
        {passwordMsg && (
          <p className="text-sm text-green-600 bg-green-50 rounded-xl px-4 py-3">{passwordMsg}</p>
        )}

        <button
          type="submit"
          disabled={loadingPassword}
          className="h-11 px-6 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {loadingPassword ? "Сохранение..." : user.passwordHash ? "Изменить пароль" : "Установить пароль"}
        </button>
      </form>
    </div>
  )
}
