import Link from "next/link"
import { Briefcase, TrendingDown, FileText, Truck } from "lucide-react"

/**
 * Блок для юр.лиц на главной. CTA: заявка + вход в оптовый кабинет.
 * Показывает ключевые тиры скидок (6/15/30/60 кг) и B2B-бенефиты.
 */
export function WholesaleCTA() {
  return (
    <section className="py-16 sm:py-20 bg-gradient-to-br from-primary/5 via-secondary/20 to-primary/5">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary text-xs font-medium px-3 py-1 mb-4">
              <Briefcase className="w-3.5 h-3.5" />
              Для юридических лиц
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold mb-3">
              Оптовые поставки кофе
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Для кофеен, HoReCa, ритейла и корпоративных клиентов.
              Прямой контракт, выгодные цены от объёма, оплата по отсрочке.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            <TierCard weight={6} discount={3} />
            <TierCard weight={15} discount={5} />
            <TierCard weight={30} discount={9} />
            <TierCard weight={60} discount={20} highlight />
          </div>

          <div className="grid md:grid-cols-3 gap-4 mb-8">
            <Benefit
              icon={FileText}
              title="Все документы"
              text="Счёт, УПД, акт сверки, договор поставки — автоматически"
            />
            <Benefit
              icon={TrendingDown}
              title="Скидка от объёма"
              text="Чем больше общий вес корзины, тем ниже цена каждой пачки"
            />
            <Benefit
              icon={Truck}
              title="Гибкая логистика"
              text="СДЭК, Почта России, курьером по Москве, свой транспорт"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/wholesale/register"
              className="inline-flex items-center justify-center rounded-xl bg-primary text-primary-foreground font-medium px-6 py-3 hover:bg-primary/90 transition-colors"
            >
              Подать заявку на опт
            </Link>
            <Link
              href="/wholesale/login"
              className="inline-flex items-center justify-center rounded-xl border border-border bg-white font-medium px-6 py-3 hover:bg-muted transition-colors"
            >
              Уже есть доступ — войти
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

function TierCard({
  weight,
  discount,
  highlight,
}: {
  weight: number
  discount: number
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-2xl p-4 text-center ${
        highlight
          ? "bg-primary text-primary-foreground shadow-lg"
          : "bg-white border border-border"
      }`}
    >
      <div className="text-xs opacity-80">от</div>
      <div className="font-serif text-2xl font-bold">{weight} кг</div>
      <div className="text-xs mt-1 opacity-80">скидка</div>
      <div
        className={`font-bold text-xl ${highlight ? "" : "text-primary"}`}
      >
        −{discount}%
      </div>
    </div>
  )
}

function Benefit({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Briefcase
  title: string
  text: string
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm">
      <div className="inline-flex p-2 rounded-lg bg-primary/10 text-primary mb-3">
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  )
}
