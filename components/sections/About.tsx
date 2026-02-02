import Image from "next/image"
import { Coffee, Leaf, Timer, Heart } from "lucide-react"

export function About() {
  return (
    <section id="about" className="py-20 sm:py-28 bg-white overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Content */}
          <div>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-foreground mb-6">
              Кофе для ценителей вкуса
            </h2>
            <p className="text-muted-foreground text-lg mb-6 leading-relaxed">
              Millor Coffee — это команда энтузиастов, которые влюблены в кофе.
              Мы отбираем лучшие зёрна для тех, кто ценит качество у себя дома.
              Каждая обжарка — под ваш заказ.
            </p>
            <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
              Наша миссия — подарить вам ритуал идеального утра.
              Чашка свежеобжаренного кофе дома — это маленькая роскошь на каждый день.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Leaf className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <div className="font-bold text-2xl text-foreground">100%</div>
                  <div className="text-sm text-muted-foreground">Арабика высшего сорта</div>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Timer className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <div className="font-bold text-2xl text-foreground">24ч</div>
                  <div className="text-sm text-muted-foreground">Отправка в день обжарки</div>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Coffee className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <div className="font-bold text-2xl text-foreground">10+ лет</div>
                  <div className="text-sm text-muted-foreground">Опыт обжарки кофе</div>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Heart className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <div className="font-bold text-2xl text-foreground">1000+</div>
                  <div className="text-sm text-muted-foreground">Довольных клиентов</div>
                </div>
              </div>
            </div>
          </div>

          {/* Visual - Photo Grid */}
          <div className="relative">
            <div className="grid grid-cols-2 gap-4">
              <div className="aspect-square rounded-2xl overflow-hidden">
                <Image
                  src="/images/1.jpg"
                  alt="Кофейные зёрна"
                  width={300}
                  height={300}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="aspect-square rounded-2xl overflow-hidden">
                <Image
                  src="/images/2.jpg"
                  alt="Процесс обжарки"
                  width={300}
                  height={300}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="aspect-square rounded-2xl overflow-hidden">
                <Image
                  src="/images/3.jpg"
                  alt="Свежий кофе"
                  width={300}
                  height={300}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="aspect-square rounded-2xl overflow-hidden">
                <Image
                  src="/images/4.jpg"
                  alt="Упаковка кофе"
                  width={300}
                  height={300}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                />
              </div>
            </div>

            {/* Floating card */}
            <div className="absolute -bottom-6 -left-6 bg-white rounded-2xl shadow-xl p-6 max-w-[200px] z-10">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
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
