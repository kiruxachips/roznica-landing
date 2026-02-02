import { ArrowRight } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { TrackedLink } from "@/components/ui/tracked-link"
import { cn } from "@/lib/utils"
import { CATALOG_URL, SHOP_URL } from "@/lib/constants"

export function Contact() {
  return (
    <section id="contact" className="py-20 sm:py-28 bg-gradient-to-br from-primary via-coffee-700 to-coffee-900 text-white relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-white blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full bg-white blur-3xl" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          {/* Heading */}
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
            Попробуйте вкус настоящего specialty-кофе
          </h2>

          {/* Subheading */}
          <p className="text-lg sm:text-xl text-white/80 mb-10 max-w-2xl mx-auto">
            Закажите прямо сейчас и получите бесплатную доставку при заказе от 3000 рублей.
            Мы обжарим кофе специально для вас!
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <TrackedLink
              href={CATALOG_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ size: "xl" }),
                "bg-white text-primary hover:bg-white/90 group flex items-center gap-2"
              )}
            >
              Перейти в каталог
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </TrackedLink>
            <TrackedLink
              href={SHOP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center h-14 px-10 text-lg font-medium rounded-lg border-2 border-white/50 text-white bg-white/10 hover:bg-white/20 transition-all"
            >
              Главная магазина
            </TrackedLink>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap justify-center gap-8 mt-12 pt-8 border-t border-white/10">
            <div className="flex items-center gap-2 text-white/70 text-sm">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Безопасная оплата
            </div>
            <div className="flex items-center gap-2 text-white/70 text-sm">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Доставка по РФ
            </div>
            <div className="flex items-center gap-2 text-white/70 text-sm">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Гарантия свежести
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
