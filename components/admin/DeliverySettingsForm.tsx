"use client"

import { useState } from "react"
import type { DeliveryMarkupRule } from "@prisma/client"
import {
  updateDeliverySettings,
  createMarkupRule,
  updateMarkupRule,
  deleteMarkupRule,
  testCdekConnection,
} from "@/lib/actions/delivery-settings"

const tabs = [
  { id: "general", label: "Общие" },
  { id: "cdek", label: "СДЭК" },
  { id: "pochta", label: "Почта РФ" },
  { id: "courier", label: "Курьер" },
  { id: "addresses", label: "Адреса / Карты" },
  { id: "markups", label: "Наценки" },
]

interface Props {
  settings: Record<string, string>
  rules: DeliveryMarkupRule[]
}

interface SenderLocation {
  name: string
  city: string
  cityCode: string
  postalCode: string
  isDefault: boolean
}

function parseSenderLocations(json: string): SenderLocation[] {
  try {
    const arr = JSON.parse(json)
    if (Array.isArray(arr) && arr.length > 0) return arr
  } catch { /* ignore */ }
  return []
}

export function DeliverySettingsForm({ settings, rules }: Props) {
  const [activeTab, setActiveTab] = useState("general")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [localSettings, setLocalSettings] = useState(settings)
  const [localRules, setLocalRules] = useState(rules)
  const [testing, setTesting] = useState(false)
  const [senderLocations, setSenderLocations] = useState<SenderLocation[]>(() =>
    parseSenderLocations(settings.sender_locations || "[]")
  )

  function set(key: string, value: string) {
    setLocalSettings((prev) => ({ ...prev, [key]: value }))
  }

  function updateSenderLocations(locations: SenderLocation[]) {
    setSenderLocations(locations)
    setLocalSettings((prev) => ({
      ...prev,
      sender_locations: JSON.stringify(locations),
    }))
  }

  function addSenderLocation() {
    const locations = [
      ...senderLocations,
      {
        name: "Новый склад",
        city: "",
        cityCode: "",
        postalCode: "",
        isDefault: senderLocations.length === 0,
      },
    ]
    updateSenderLocations(locations)
  }

  function removeSenderLocation(index: number) {
    const locations = senderLocations.filter((_, i) => i !== index)
    // Ensure at least one default
    if (locations.length > 0 && !locations.some((l) => l.isDefault)) {
      locations[0].isDefault = true
    }
    updateSenderLocations(locations)
  }

  function setSenderField(index: number, field: keyof SenderLocation, value: string | boolean) {
    const locations = senderLocations.map((loc, i) => {
      if (i !== index) {
        // If setting isDefault, unset others
        if (field === "isDefault" && value === true) {
          return { ...loc, isDefault: false }
        }
        return loc
      }
      return { ...loc, [field]: value }
    })
    updateSenderLocations(locations)
  }

  async function handleSave() {
    setSaving(true)
    setMessage("")
    try {
      await updateDeliverySettings(localSettings)
      setMessage("Настройки сохранены")
    } catch {
      setMessage("Ошибка сохранения")
    } finally {
      setSaving(false)
    }
  }

  async function handleTestCdek() {
    setTesting(true)
    setMessage("")
    try {
      const result = await testCdekConnection(
        localSettings.cdek_client_id || "",
        localSettings.cdek_client_secret || "",
        localSettings.cdek_test_mode === "true"
      )
      setMessage(result.success ? "СДЭК: подключение успешно!" : `СДЭК: ошибка — ${result.error}`)
    } catch {
      setMessage("Ошибка проверки подключения")
    } finally {
      setTesting(false)
    }
  }

  async function handleAddRule() {
    try {
      await createMarkupRule({
        name: "Новая наценка",
        carrier: "all",
        type: "percent",
        value: 10,
      })
      // Reload page to get fresh data
      window.location.reload()
    } catch {
      setMessage("Ошибка добавления правила")
    }
  }

  async function handleDeleteRule(id: string) {
    if (!confirm("Удалить правило наценки?")) return
    try {
      await deleteMarkupRule(id)
      setLocalRules((prev) => prev.filter((r) => r.id !== id))
    } catch {
      setMessage("Ошибка удаления")
    }
  }

  async function handleUpdateRule(id: string, data: Partial<DeliveryMarkupRule>) {
    try {
      await updateMarkupRule(id, data)
      setLocalRules((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...data } : r))
      )
    } catch {
      setMessage("Ошибка обновления правила")
    }
  }

  const inputClass =
    "w-full h-10 px-3 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
  const labelClass = "block text-sm font-medium mb-1"

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-xl">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-white text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-border space-y-5">
        {activeTab === "general" && (
          <>
            <h2 className="text-lg font-semibold">Общие настройки</h2>

            {/* Sender locations */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-md font-semibold">Склады отправки</h3>
                <button
                  type="button"
                  onClick={addSenderLocation}
                  className="px-3 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Добавить склад
                </button>
              </div>

              {senderLocations.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Нет складов. Добавьте хотя бы один город отправки.
                </p>
              )}

              {senderLocations.map((loc, i) => (
                <div
                  key={i}
                  className={`border rounded-lg p-4 space-y-3 ${
                    loc.isDefault ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className={labelClass}>Название</label>
                      <input
                        className={inputClass}
                        value={loc.name}
                        onChange={(e) => setSenderField(i, "name", e.target.value)}
                        placeholder="СПб склад"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Город</label>
                      <input
                        className={inputClass}
                        value={loc.city}
                        onChange={(e) => setSenderField(i, "city", e.target.value)}
                        placeholder="Санкт-Петербург"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Код СДЭК</label>
                      <input
                        className={inputClass}
                        value={loc.cityCode}
                        onChange={(e) => setSenderField(i, "cityCode", e.target.value)}
                        placeholder="137"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Индекс</label>
                      <input
                        className={inputClass}
                        value={loc.postalCode}
                        onChange={(e) => setSenderField(i, "postalCode", e.target.value)}
                        placeholder="190000"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="defaultSender"
                        checked={loc.isDefault}
                        onChange={() => setSenderField(i, "isDefault", true)}
                        className="accent-primary"
                      />
                      По умолчанию
                    </label>
                    <button
                      type="button"
                      onClick={() => removeSenderLocation(i)}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <label className={labelClass}>Процент бонусов (%)</label>
              <input
                className={inputClass}
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={localSettings.bonus_rate || "5"}
                onChange={(e) => set("bonus_rate", e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Процент от суммы заказа, начисляемый как бонусы при доставке
              </p>
            </div>

            <div>
              <label className={labelClass}>Порог бесплатной доставки (₽)</label>
              <input
                className={inputClass}
                type="number"
                value={localSettings.free_delivery_threshold || ""}
                onChange={(e) => set("free_delivery_threshold", e.target.value)}
              />
            </div>

            <div>
              <label className={labelClass}>Порог подарка (₽, 0 — отключено)</label>
              <input
                className={inputClass}
                type="number"
                value={localSettings.gift_threshold || ""}
                onChange={(e) => set("gift_threshold", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Описание подарка</label>
              <input
                className={inputClass}
                type="text"
                placeholder="Подарок от нас"
                value={localSettings.gift_description || ""}
                onChange={(e) => set("gift_description", e.target.value)}
              />
            </div>

            <h3 className="text-md font-semibold pt-2">Габариты по умолчанию</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className={labelClass}>Вес (г)</label>
                <input
                  className={inputClass}
                  type="number"
                  value={localSettings.default_weight_grams || ""}
                  onChange={(e) => set("default_weight_grams", e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Длина (см)</label>
                <input
                  className={inputClass}
                  type="number"
                  value={localSettings.default_length_cm || ""}
                  onChange={(e) => set("default_length_cm", e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Ширина (см)</label>
                <input
                  className={inputClass}
                  type="number"
                  value={localSettings.default_width_cm || ""}
                  onChange={(e) => set("default_width_cm", e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Высота (см)</label>
                <input
                  className={inputClass}
                  type="number"
                  value={localSettings.default_height_cm || ""}
                  onChange={(e) => set("default_height_cm", e.target.value)}
                />
              </div>
            </div>

          </>
        )}

        {activeTab === "addresses" && (
          <>
            <h2 className="text-lg font-semibold">Адреса и карты</h2>
            <p className="text-sm text-muted-foreground">
              Подсказки адреса при оформлении, индексы для Почты России, карта
              пунктов выдачи.
            </p>

            <div>
              <label className={labelClass}>API-ключ DaData (подсказки адресов)</label>
              <input
                className={inputClass}
                type="password"
                value={localSettings.dadata_api_key || ""}
                onChange={(e) => set("dadata_api_key", e.target.value)}
                placeholder="Token ..."
              />
              <p className="text-xs text-muted-foreground mt-1">
                Подсказки по российским адресам (улицы и дома) в поле «Адрес».
                Бесплатный лимит — 10 000 запросов/день. Получить ключ:{" "}
                <a
                  href="https://dadata.ru/api/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  dadata.ru/api
                </a>
                .
              </p>
            </div>

            <div>
              <label className={labelClass}>API-ключ Яндекс.Карт</label>
              <input
                className={inputClass}
                value={localSettings.yandex_maps_api_key || ""}
                onChange={(e) => set("yandex_maps_api_key", e.target.value)}
                placeholder="Для карты ПВЗ и запасных подсказок"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Используется для отображения карты пунктов выдачи и как
                запасной геокодер, если DaData не настроен. Получить ключ:{" "}
                <a
                  href="https://developer.tech.yandex.ru/services/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  developer.tech.yandex.ru
                </a>
                .
              </p>
            </div>
          </>
        )}

        {activeTab === "cdek" && (
          <>
            <h2 className="text-lg font-semibold">СДЭК</h2>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={localSettings.cdek_enabled === "true"}
                onChange={(e) => set("cdek_enabled", e.target.checked ? "true" : "false")}
                className="h-4 w-4 rounded accent-primary"
              />
              <span className="text-sm font-medium">Включить СДЭК</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Client ID</label>
                <input
                  className={inputClass}
                  value={localSettings.cdek_client_id || ""}
                  onChange={(e) => set("cdek_client_id", e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Client Secret</label>
                <input
                  className={inputClass}
                  type="password"
                  value={localSettings.cdek_client_secret || ""}
                  onChange={(e) => set("cdek_client_secret", e.target.value)}
                />
              </div>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={localSettings.cdek_test_mode === "true"}
                onChange={(e) => set("cdek_test_mode", e.target.checked ? "true" : "false")}
                className="h-4 w-4 rounded accent-primary"
              />
              <span className="text-sm">Тестовый режим (sandbox)</span>
            </label>

            <div>
              <label className={labelClass}>Тарифы</label>
              <div className="flex flex-wrap gap-3">
                {[
                  { code: 136, name: "Посылка склад-склад" },
                  { code: 137, name: "Посылка склад-дверь" },
                  { code: 233, name: "Эконом склад-склад" },
                  { code: 234, name: "Эконом склад-дверь" },
                ].map((t) => {
                  const tariffs: number[] = (() => {
                    try { return JSON.parse(localSettings.cdek_tariffs || "[]") } catch { return [] }
                  })()
                  const checked = tariffs.includes(t.code)
                  return (
                    <label key={t.code} className="flex items-center gap-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...tariffs, t.code]
                            : tariffs.filter((c) => c !== t.code)
                          set("cdek_tariffs", JSON.stringify(next))
                        }}
                        className="h-4 w-4 rounded accent-primary"
                      />
                      {t.name}
                    </label>
                  )
                })}
              </div>
            </div>

            <button
              onClick={handleTestCdek}
              disabled={testing}
              className="px-4 py-2 text-sm rounded-lg border border-primary text-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
            >
              {testing ? "Проверка..." : "Проверить подключение"}
            </button>
          </>
        )}

        {activeTab === "pochta" && (
          <>
            <h2 className="text-lg font-semibold">Почта России</h2>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={localSettings.pochta_enabled === "true"}
                onChange={(e) => set("pochta_enabled", e.target.checked ? "true" : "false")}
                className="h-4 w-4 rounded accent-primary"
              />
              <span className="text-sm font-medium">Включить Почту России</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Access Token</label>
                <input
                  className={inputClass}
                  type="password"
                  value={localSettings.pochta_access_token || ""}
                  onChange={(e) => set("pochta_access_token", e.target.value)}
                  placeholder="Для создания отправок"
                />
              </div>
              <div>
                <label className={labelClass}>X-User-Authorization</label>
                <input
                  className={inputClass}
                  type="password"
                  value={localSettings.pochta_user_auth || ""}
                  onChange={(e) => set("pochta_user_auth", e.target.value)}
                  placeholder="Basic ..."
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Тип отправления</label>
              <select
                className={inputClass}
                value={localSettings.pochta_object_type || "23030"}
                onChange={(e) => set("pochta_object_type", e.target.value)}
              >
                <option value="23030">Посылка онлайн обыкновенная — рекомендуется для интернет-магазина</option>
                <option value="4030">Посылка обыкновенная</option>
                <option value="47030">Посылка 1 класса (экспресс, дорого)</option>
                <option value="27030">Посылка 1 класса нестандартная</option>
              </select>
            </div>
            <p className="text-xs text-muted-foreground">
              Расчёт стоимости работает без токенов. Токены нужны только для автоматического создания отправок.
            </p>

            <h3 className="text-md font-semibold pt-4">Трекинг</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Логин tracking.pochta.ru</label>
                <input
                  className={inputClass}
                  value={localSettings.pochta_tracking_login || ""}
                  onChange={(e) => set("pochta_tracking_login", e.target.value)}
                  placeholder="Логин"
                />
              </div>
              <div>
                <label className={labelClass}>Пароль tracking.pochta.ru</label>
                <input
                  className={inputClass}
                  type="password"
                  value={localSettings.pochta_tracking_password || ""}
                  onChange={(e) => set("pochta_tracking_password", e.target.value)}
                  placeholder="Пароль"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Для отслеживания отправлений. Получите учётные данные на{" "}
              <a href="https://tracking.pochta.ru" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                tracking.pochta.ru
              </a>
            </p>
          </>
        )}

        {activeTab === "courier" && (
          <>
            <h2 className="text-lg font-semibold">Курьерская доставка</h2>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={localSettings.courier_enabled === "true"}
                onChange={(e) => set("courier_enabled", e.target.checked ? "true" : "false")}
                className="h-4 w-4 rounded accent-primary"
              />
              <span className="text-sm font-medium">Включить курьера</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Город</label>
                <input
                  className={inputClass}
                  value={localSettings.courier_city || ""}
                  onChange={(e) => set("courier_city", e.target.value)}
                  placeholder="Калининград"
                />
              </div>
              <div>
                <label className={labelClass}>Цена (₽)</label>
                <input
                  className={inputClass}
                  type="number"
                  value={localSettings.courier_price || ""}
                  onChange={(e) => set("courier_price", e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Бесплатно от (₽)</label>
                <input
                  className={inputClass}
                  type="number"
                  value={localSettings.courier_free_threshold || ""}
                  onChange={(e) => set("courier_free_threshold", e.target.value)}
                />
              </div>
            </div>
          </>
        )}

        {activeTab === "markups" && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Правила наценок</h2>
              <button
                onClick={handleAddRule}
                className="px-3 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Добавить
              </button>
            </div>

            {localRules.length === 0 ? (
              <p className="text-sm text-muted-foreground">Нет правил наценок</p>
            ) : (
              <div className="space-y-3">
                {localRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="border border-border rounded-lg p-4 space-y-3"
                  >
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className={labelClass}>Название</label>
                        <input
                          className={inputClass}
                          value={rule.name}
                          onChange={(e) =>
                            handleUpdateRule(rule.id, { name: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Перевозчик</label>
                        <select
                          className={inputClass}
                          value={rule.carrier}
                          onChange={(e) =>
                            handleUpdateRule(rule.id, { carrier: e.target.value })
                          }
                        >
                          <option value="all">Все</option>
                          <option value="cdek">СДЭК</option>
                          <option value="pochta">Почта РФ</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Тип</label>
                        <select
                          className={inputClass}
                          value={rule.type}
                          onChange={(e) =>
                            handleUpdateRule(rule.id, { type: e.target.value })
                          }
                        >
                          <option value="percent">Процент (+%)</option>
                          <option value="fixed">Фиксированная (+₽)</option>
                          <option value="replace">Замена (₽)</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Значение</label>
                        <input
                          className={inputClass}
                          type="number"
                          value={rule.value}
                          onChange={(e) =>
                            handleUpdateRule(rule.id, {
                              value: parseInt(e.target.value) || 0,
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={rule.isActive}
                          onChange={(e) =>
                            handleUpdateRule(rule.id, { isActive: e.target.checked })
                          }
                          className="h-4 w-4 rounded accent-primary"
                        />
                        Активно
                      </label>
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Save & message */}
      {activeTab !== "markups" && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saving ? "Сохранение..." : "Сохранить настройки"}
        </button>
      )}

      {message && (
        <p
          className={`text-sm px-4 py-2 rounded-lg ${
            message.includes("ошибка") || message.includes("Ошибка")
              ? "bg-red-50 text-red-600"
              : "bg-green-50 text-green-600"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  )
}
