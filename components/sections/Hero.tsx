import { ArrowRight } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { TrackedLink } from "@/components/ui/tracked-link"
import { cn } from "@/lib/utils"
import { CATALOG_URL } from "@/lib/constants"

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-coffee-50 via-white to-secondary">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-20 left-10 w-64 h-64 rounded-full bg-primary blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-accent blur-3xl" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Heading */}
          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 animate-fade-in [animation-delay:100ms]">
            Свежеобжаренный{" "}
            <span className="text-primary">кофе</span>{" "}
            для дома с доставкой
          </h1>

          {/* Subheading */}
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in [animation-delay:200ms]">
            Попробуйте настоящий specialty-кофе у себя дома.
            Обжариваем под ваш заказ — вы получаете кофе
            максимальной свежести.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in [animation-delay:300ms]">
            <TrackedLink
              href={CATALOG_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ size: "xl" }), "group flex items-center gap-2")}
            >
              Попробовать кофе
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </TrackedLink>
            <a
              href="#products"
              className={cn(buttonVariants({ variant: "outline", size: "xl" }))}
            >
              Смотреть хиты
            </a>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 max-w-lg mx-auto mt-16 animate-fade-in [animation-delay:400ms]">
            <div className="text-center">
              <div className="font-serif text-3xl sm:text-4xl font-bold text-primary">15+</div>
              <div className="text-sm text-muted-foreground mt-1">сортов</div>
            </div>
            <div className="text-center">
              <div className="font-serif text-3xl sm:text-4xl font-bold text-primary">100%</div>
              <div className="text-sm text-muted-foreground mt-1">арабика</div>
            </div>
            <div className="text-center">
              <div className="font-serif text-3xl sm:text-4xl font-bold text-primary">2-3</div>
              <div className="text-sm text-muted-foreground mt-1">дня доставка</div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 border-2 border-muted-foreground/30 rounded-full flex justify-center pt-2">
          <div className="w-1 h-2 bg-muted-foreground/50 rounded-full" />
        </div>
      </div>
    </section>
  )
}
