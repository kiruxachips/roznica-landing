import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"

export default function CatalogLoading() {
  return (
    <>
      <Header />
      <main className="pt-16">
        <section className="py-6 sm:py-10">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-5 sm:mb-6">
              <div className="h-8 w-48 rounded bg-muted/40 animate-pulse" />
              <div className="mt-2 h-4 w-32 rounded bg-muted/30 animate-pulse" />
            </div>
            <div className="mb-6 flex gap-2 overflow-x-auto">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-9 w-24 rounded-lg bg-muted/30 animate-pulse shrink-0" />
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-2xl overflow-hidden border border-border">
                  <div className="aspect-square bg-muted/30 animate-pulse" />
                  <div className="p-3 space-y-2">
                    <div className="h-4 w-3/4 rounded bg-muted/30 animate-pulse" />
                    <div className="h-3 w-1/2 rounded bg-muted/20 animate-pulse" />
                    <div className="h-5 w-20 rounded bg-muted/30 animate-pulse mt-3" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
