"use client"

import { useState } from "react"
import { Copy, Check, Share2 } from "lucide-react"

export function CopyReferralLink({ link, code }: { link: string; code: string }) {
  const [copied, setCopied] = useState<"link" | "code" | null>(null)

  async function copy(what: "link" | "code") {
    const text = what === "link" ? link : code
    try {
      await navigator.clipboard.writeText(text)
      setCopied(what)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // ignore — clipboard API может быть недоступен
    }
  }

  async function share() {
    const text = `Дарю скидку на первый заказ кофе в Millor Coffee — ${link}`
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Millor Coffee", text, url: link })
        return
      } catch {
        // fallthrough
      }
    }
    await copy("link")
  }

  return (
    <div className="space-y-2">
      <div className="flex items-stretch gap-2 bg-white rounded-xl border border-border overflow-hidden">
        <input
          readOnly
          value={link}
          onClick={(e) => e.currentTarget.select()}
          className="flex-1 min-w-0 px-3 text-sm bg-transparent focus:outline-none"
        />
        <button
          type="button"
          onClick={() => copy("link")}
          className="shrink-0 px-3 border-l border-border hover:bg-muted transition-colors"
          aria-label="Скопировать ссылку"
        >
          {copied === "link" ? (
            <Check className="w-4 h-4 text-emerald-600" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={share}
          className="flex-1 h-10 bg-primary text-primary-foreground rounded-xl font-medium text-sm flex items-center justify-center gap-1.5"
        >
          <Share2 className="w-4 h-4" />
          Поделиться
        </button>
        <button
          type="button"
          onClick={() => copy("code")}
          className="h-10 px-4 border border-border rounded-xl font-medium text-sm flex items-center gap-1.5"
        >
          {copied === "code" ? (
            <Check className="w-4 h-4 text-emerald-600" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
          {copied === "code" ? "Скопировано" : "Код"}
        </button>
      </div>
    </div>
  )
}
