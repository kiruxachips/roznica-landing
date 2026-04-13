export function BlogHero() {
  return (
    <section className="bg-gradient-to-br from-secondary/50 via-white to-secondary/30 py-12 sm:py-20 lg:py-28">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="font-serif text-3xl sm:text-5xl md:text-6xl font-bold text-foreground mb-3 sm:mb-4">
          Журнал о кофе
        </h1>
        <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto">
          Статьи о кофе, обжарке, способах приготовления и кофейной культуре.
        </p>
      </div>
    </section>
  )
}
