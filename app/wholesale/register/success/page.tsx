import { Metadata } from "next"
import Link from "next/link"
import { CheckCircle2 } from "lucide-react"

export const metadata: Metadata = {
  title: "Заявка принята | Millor Coffee",
  robots: { index: false, follow: false },
}

export default function WholesaleRegisterSuccessPage() {
  return (
    <div className="container mx-auto px-4 max-w-lg">
      <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
        <div className="inline-flex mx-auto mb-4 p-3 rounded-full bg-green-50 text-green-600">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold mb-3">Заявка принята</h1>
        <p className="text-muted-foreground mb-6">
          Мы свяжемся с вами в ближайшие рабочие часы. Следите за почтой — туда придёт
          письмо с доступом к кабинету после одобрения.
        </p>
        <Link
          href="/"
          className="inline-flex rounded-xl bg-primary text-primary-foreground font-medium px-6 py-2.5 hover:bg-primary/90 transition-colors"
        >
          На главную
        </Link>
      </div>
    </div>
  )
}
