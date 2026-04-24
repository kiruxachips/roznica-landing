import { Metadata } from "next"
import { AlertTriangle } from "lucide-react"

export const metadata: Metadata = {
  title: "Доступ приостановлен | Millor Coffee",
  robots: { index: false, follow: false },
}

export default function WholesaleSuspendedPage() {
  return (
    <div className="container mx-auto px-4 max-w-lg">
      <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
        <div className="inline-flex mx-auto mb-4 p-3 rounded-full bg-yellow-50 text-yellow-600">
          <AlertTriangle className="w-10 h-10" />
        </div>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold mb-3">Доступ приостановлен</h1>
        <p className="text-muted-foreground mb-6">
          Оптовый кабинет вашей компании временно приостановлен. Свяжитесь с менеджером
          для возобновления работы.
        </p>
        <a
          href="mailto:opt@millor-coffee.ru"
          className="inline-flex rounded-xl bg-primary text-primary-foreground font-medium px-6 py-2.5 hover:bg-primary/90 transition-colors"
        >
          Написать менеджеру
        </a>
      </div>
    </div>
  )
}
