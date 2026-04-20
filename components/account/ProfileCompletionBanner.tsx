import Link from "next/link"
import { Mail, Phone, User as UserIcon, ArrowRight } from "lucide-react"

interface ProfileCompletionBannerProps {
  hasEmail: boolean
  hasPhone: boolean
  hasName: boolean
}

export function ProfileCompletionBanner({ hasEmail, hasPhone, hasName }: ProfileCompletionBannerProps) {
  const missing: Array<{ icon: typeof Mail; label: string }> = []
  if (!hasName) missing.push({ icon: UserIcon, label: "имя" })
  if (!hasEmail) missing.push({ icon: Mail, label: "email" })
  if (!hasPhone) missing.push({ icon: Phone, label: "телефон" })

  if (missing.length === 0) return null

  const labels = missing.map((m) => m.label).join(", ")

  return (
    <Link
      href="/account/profile"
      className="group block bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-2xl p-4 sm:p-5 hover:border-primary/40 transition-colors"
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="hidden sm:flex w-10 h-10 bg-primary/15 rounded-xl items-center justify-center shrink-0">
          <UserIcon className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm sm:text-base mb-0.5">
            Заполните профиль — {labels}
          </p>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Это ускорит оформление заказов и позволит получать уведомления о статусе доставки
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            {missing.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 text-xs bg-white/70 text-muted-foreground rounded-full px-2.5 py-1"
              >
                <Icon className="w-3 h-3" />
                {label}
              </span>
            ))}
          </div>
        </div>
        <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0 mt-1 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </Link>
  )
}
