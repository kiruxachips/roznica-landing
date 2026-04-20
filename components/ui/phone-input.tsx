"use client"

import { forwardRef, useState, useEffect, useMemo, useRef } from "react"

/**
 * Поле ввода российского номера телефона с автоматической маской «+7 (XXX) XXX-XX-XX».
 *
 * Поведение:
 * - При вводе любой цифры в пустое поле префикс +7 подставляется автоматически.
 * - Если первая введённая цифра 8 — она заменяется на 7 (вместо 8-9XX мы делаем +79XX).
 * - Backspace корректно стирает цифры с конца; при полной очистке поле опустошается.
 * - Пасят +7XXXXXXXXXX, 8XXXXXXXXXX или 9XX… — все приводятся к +7XXXXXXXXXX.
 *
 * В форме поле ведёт себя как обычный `<input name>` — значение (с маской) уйдёт в FormData;
 * сервер уже нормализует телефон через `.replace(/\D/g, "")`.
 */

export function extractDigits(value: string): string {
  return value.replace(/\D/g, "")
}

/** Нормализует цифры: всегда начинается с 7, максимум 11 цифр. */
export function normalizePhoneDigits(raw: string): string {
  let d = extractDigits(raw)
  if (!d) return ""
  if (d.startsWith("8")) d = "7" + d.slice(1)
  if (!d.startsWith("7")) d = "7" + d
  return d.slice(0, 11)
}

export function formatPhoneDisplay(digitsOrRaw: string): string {
  const d = normalizePhoneDigits(digitsOrRaw)
  if (!d) return ""
  const rest = d.slice(1) // то, что после 7
  let out = "+7"
  if (rest.length > 0) out += " (" + rest.slice(0, 3)
  if (rest.length >= 3) out += ")"
  if (rest.length > 3) out += " " + rest.slice(3, 6)
  if (rest.length > 6) out += "-" + rest.slice(6, 8)
  if (rest.length > 8) out += "-" + rest.slice(8, 10)
  return out
}

/** Возвращает телефон в формате E.164-ish: +7XXXXXXXXXX (только если 11 цифр) */
export function toE164(digitsOrRaw: string): string {
  const d = normalizePhoneDigits(digitsOrRaw)
  return d.length === 11 ? "+" + d : ""
}

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "defaultValue" | "type"> {
  /** Контролируемое значение — можно передавать в любом формате, внутри нормализуется */
  value?: string
  defaultValue?: string
  /** onChange получает отформатированную строку «+7 (XXX) XXX-XX-XX» */
  onChange?: (formatted: string) => void
  /** onDigitsChange получает только цифры в формате 7XXXXXXXXXX */
  onDigitsChange?: (digits: string) => void
}

export const PhoneInput = forwardRef<HTMLInputElement, Props>(function PhoneInput(
  { value, defaultValue, onChange, onDigitsChange, placeholder, ...rest },
  ref
) {
  const isControlled = value !== undefined
  const [internal, setInternal] = useState(() => formatPhoneDisplay(value ?? defaultValue ?? ""))
  const lastDigitsRef = useRef(normalizePhoneDigits(value ?? defaultValue ?? ""))

  // Синхронизация внешнего value
  useEffect(() => {
    if (isControlled) {
      const next = formatPhoneDisplay(value ?? "")
      setInternal(next)
      lastDigitsRef.current = normalizePhoneDigits(value ?? "")
    }
  }, [value, isControlled])

  const displayValue = useMemo(
    () => (isControlled ? formatPhoneDisplay(value ?? "") : internal),
    [isControlled, value, internal]
  )

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const rawDigits = extractDigits(e.target.value)
    const prevDigits = lastDigitsRef.current
    // Попытка поймать backspace, когда юзер стёр символ маски (скобку/тире),
    // в этом случае цифр в строке не уменьшилось — отнимем последнюю сами.
    let digits = rawDigits
    if (rawDigits.length === prevDigits.length && e.target.value.length < displayValue.length) {
      digits = rawDigits.slice(0, -1)
    }
    const normalized = normalizePhoneDigits(digits)
    const formatted = formatPhoneDisplay(normalized)
    lastDigitsRef.current = normalized
    if (!isControlled) setInternal(formatted)
    onChange?.(formatted)
    onDigitsChange?.(normalized)
  }

  return (
    <input
      ref={ref}
      type="tel"
      inputMode="numeric"
      autoComplete="tel"
      value={displayValue}
      onChange={handleChange}
      placeholder={placeholder ?? "+7 (999) 123-45-67"}
      {...rest}
    />
  )
})
