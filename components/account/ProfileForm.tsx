"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { updateProfile, changePassword } from "@/lib/actions/profile"
import { PhoneInput } from "@/components/ui/phone-input"

interface ProfileFormProps {
  user: {
    name: string | null
    email: string | null
    phone: string | null
    defaultAddress: string | null
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
    })

    setLoadingProfile(false)

    if (result.error) {
      setProfileError(result.error)
    } else {
      setProfileMsg("Профиль сохранён")
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
      <form onSubmit={handleProfileSubmit} className="bg-white rounded-2xl shadow-sm p-4 sm:p-6 space-y-4">
        <h2 className="text-lg font-semibold">Личные данные</h2>

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
          <input
            value={user.email || ""}
            readOnly
            className="w-full h-11 px-4 rounded-xl border border-input text-sm bg-muted/50 text-muted-foreground"
          />
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

        <button
          type="submit"
          disabled={loadingProfile}
          className="h-11 px-6 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {loadingProfile ? "Сохранение..." : "Сохранить"}
        </button>
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
