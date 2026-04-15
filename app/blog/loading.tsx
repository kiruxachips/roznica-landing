import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"

export default function BlogLoading() {
  return (
    <>
      <Header />
      <main className="pt-16">
        <section className="py-8 sm:py-12">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-6 h-9 w-56 rounded bg-muted/40 animate-pulse" />
            <div className="mb-6 flex gap-2 overflow-x-auto">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-9 w-28 rounded-lg bg-muted/30 animate-pulse shrink-0" />
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-2xl overflow-hidden border border-border">
                  <div className="aspect-[16/10] bg-muted/30 animate-pulse" />
                  <div className="p-4 space-y-2">
                    <div className="h-5 w-3/4 rounded bg-muted/40 animate-pulse" />
                    <div className="h-3 w-full rounded bg-muted/20 animate-pulse" />
                    <div className="h-3 w-2/3 rounded bg-muted/20 animate-pulse" />
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
