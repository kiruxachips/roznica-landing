"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { verifyEmailCode, resendVerificationCode } from "@/lib/actions/auth"

export function VerifyCodeForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get("email") || ""
  const [code, setCode] = useState(["", "", "", "", "", ""])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  function handleChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return

    const newCode = [...code]
    newCode[index] = value.slice(-1)
    setCode(newCode)

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-submit when all filled
    if (newCode.every((d) => d !== "")) {
      handleVerify(newCode.join(""))
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)
    if (pasted.length === 6) {
      const newCode = pasted.split("")
      setCode(newCode)
      inputRefs.current[5]?.focus()
      handleVerify(pasted)
    }
  }

  async function handleVerify(codeStr: string) {
    setError("")
    setLoading(true)

    const result = await verifyEmailCode(email, codeStr)

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    router.push("/auth/login?verified=1")
  }

  async function handleResend() {
    setError("")
    const result = await resendVerificationCode(email)
    if (result.error) {
      setError(result.error)
    } else {
      setResendCooldown(60)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 sm:p-8">
      <h1 className="text-2xl font-sans font-bold text-center mb-2">Подтверждение email</h1>
      <p className="text-sm text-muted-foreground text-center mb-6 break-words">
        Введите код, отправленный на <span className="font-medium text-foreground">{email}</span>
      </p>

      <div className="flex justify-center gap-1.5 sm:gap-2 mb-6" onPaste={handlePaste}>
        {code.map((digit, i) => (
          <input
            key={i}
            ref={(el) => { inputRefs.current[i] = el }}
            type="text"
            inputMode="numeric"
            pattern="\d*"
            maxLength={1}
            autoComplete={i === 0 ? "one-time-code" : "off"}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className="w-10 h-12 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-bold rounded-xl border border-input focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={loading}
          />
        ))}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3 mb-4 text-center">{error}</p>
      )}

      {loading && (
        <p className="text-sm text-muted-foreground text-center mb-4">Проверка кода...</p>
      )}

      <div className="text-center">
        <button
          type="button"
          onClick={handleResend}
          disabled={resendCooldown > 0}
          className="text-sm text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
        >
          {resendCooldown > 0
            ? `Отправить повторно (${resendCooldown}с)`
            : "Отправить код повторно"}
        </button>
      </div>
    </div>
  )
}
