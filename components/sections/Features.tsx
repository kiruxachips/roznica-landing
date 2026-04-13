import { Flame, Award, Truck, Gift } from "lucide-react"
import { features } from "@/lib/constants"

const iconMap = {
  Flame: Flame,
  Award: Award,
  Truck: Truck,
  Gift: Gift,
}

export function Features() {
  return (
    <section id="features" className="py-16 sm:py-20 lg:py-28 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-16">
          <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-3 sm:mb-4">
            Почему выбирают нас
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg">
            Мы заботимся о каждом этапе — от выбора зерна до доставки к вашей двери
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 lg:gap-8">
          {features.map((feature, index) => {
            const Icon = iconMap[feature.icon as keyof typeof iconMap]
            return (
              <div
                key={feature.title}
                className="group text-center p-4 sm:p-6 rounded-2xl bg-secondary/30 sm:bg-transparent hover:bg-secondary/50 transition-all duration-300"
              >
                <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-6 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:scale-110 transition-all duration-300">
                  <Icon className="w-6 h-6 sm:w-8 sm:h-8 text-primary group-hover:text-white transition-colors" />
                </div>
                <h3 className="font-semibold text-sm sm:text-lg text-foreground mb-1.5 sm:mb-2">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
