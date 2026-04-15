import Image from "next/image"
import { Coffee, Leaf, Timer, Heart } from "lucide-react"
import { CoffeeShopsMap } from "./CoffeeShopsMap"

export function About() {
  return (
    <section id="about" className="py-16 sm:py-20 lg:py-28 bg-white overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-10 sm:gap-12 lg:gap-16 items-center">
          {/* Content */}
          <div className="order-1">
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-foreground mb-5">
              Кофе для ценителей вкуса
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg mb-4 leading-relaxed">
              Millor Coffee — это команда энтузиастов, которые влюблены в кофе.
              Мы отбираем лучшие зёрна для тех, кто ценит качество у себя дома.
              Каждая обжарка — под ваш заказ.
            </p>
            <p className="text-muted-foreground text-base sm:text-lg mb-6 leading-relaxed">
              Наша миссия — подарить вам ритуал идеального утра.
              Чашка свежеобжаренного кофе дома — это маленькая роскошь на каждый день.
            </p>

            <div className="mb-8">
              <CoffeeShopsMap />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 sm:gap-6">
              <div className="flex items-center gap-3 sm:items-start sm:gap-4 p-3 sm:p-0 rounded-xl bg-secondary/40 sm:bg-transparent">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Leaf className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-xl sm:text-2xl text-foreground leading-tight">100%</div>
                  <div className="text-xs sm:text-sm text-muted-foreground leading-tight">Арабика высшего сорта</div>
                </div>
              </div>
              <div className="flex items-center gap-3 sm:items-start sm:gap-4 p-3 sm:p-0 rounded-xl bg-secondary/40 sm:bg-transparent">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Timer className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-xl sm:text-2xl text-foreground leading-tight">24ч</div>
                  <div className="text-xs sm:text-sm text-muted-foreground leading-tight">Отправка в день обжарки</div>
                </div>
              </div>
              <div className="flex items-center gap-3 sm:items-start sm:gap-4 p-3 sm:p-0 rounded-xl bg-secondary/40 sm:bg-transparent">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Coffee className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-xl sm:text-2xl text-foreground leading-tight">10+ лет</div>
                  <div className="text-xs sm:text-sm text-muted-foreground leading-tight">Опыт обжарки кофе</div>
                </div>
              </div>
              <div className="flex items-center gap-3 sm:items-start sm:gap-4 p-3 sm:p-0 rounded-xl bg-secondary/40 sm:bg-transparent">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Heart className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-xl sm:text-2xl text-foreground leading-tight">1000+</div>
                  <div className="text-xs sm:text-sm text-muted-foreground leading-tight">Довольных клиентов</div>
                </div>
              </div>
            </div>
          </div>

          {/* Visual - Photo Grid */}
          <div className="relative order-2 lg:pb-6">
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="aspect-square rounded-xl sm:rounded-2xl overflow-hidden">
                <Image
                  src="/images/about-1.webp"
                  alt="Кофейные зёрна"
                  width={450}
                  height={450}
                  sizes="(max-width: 1024px) 50vw, 25vw"
                  quality={80}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="aspect-square rounded-xl sm:rounded-2xl overflow-hidden">
                <Image
                  src="/images/about-2.webp"
                  alt="Процесс обжарки"
                  width={450}
                  height={450}
                  sizes="(max-width: 1024px) 50vw, 25vw"
                  quality={80}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="aspect-square rounded-xl sm:rounded-2xl overflow-hidden">
                <Image
                  src="/images/about-3.webp"
                  alt="Свежий кофе"
                  width={450}
                  height={450}
                  sizes="(max-width: 1024px) 50vw, 25vw"
                  quality={80}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="aspect-square rounded-xl sm:rounded-2xl overflow-hidden">
                <Image
                  src="/images/about-4.webp"
                  alt="Упаковка кофе"
                  width={450}
                  height={450}
                  sizes="(max-width: 1024px) 50vw, 25vw"
                  quality={80}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                />
              </div>
            </div>

            {/* Floating card — desktop only to avoid overlap on mobile */}
            <div className="hidden lg:block absolute -bottom-6 -left-6 bg-white rounded-2xl shadow-xl p-6 max-w-[220px] z-10">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="font-medium text-sm">Премиум качество</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Все наши сорта — это отборная арабика высшего сорта
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
