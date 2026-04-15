import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"

export default function ProductLoading() {
  return (
    <>
      <Header />
      <main className="pt-16">
        <section className="py-6 sm:py-10">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-4 h-3 w-64 rounded bg-muted/30 animate-pulse" />
            <div className="grid lg:grid-cols-2 gap-8">
              <div className="aspect-square rounded-2xl bg-muted/30 animate-pulse" />
              <div className="space-y-5">
                <div className="h-9 w-3/4 rounded bg-muted/40 animate-pulse" />
                <div className="h-4 w-32 rounded bg-muted/30 animate-pulse" />
                <div className="h-4 w-full rounded bg-muted/20 animate-pulse" />
                <div className="h-4 w-5/6 rounded bg-muted/20 animate-pulse" />
                <div className="h-12 w-40 rounded-xl bg-muted/40 animate-pulse mt-6" />
                <div className="h-12 w-full rounded-xl bg-primary/30 animate-pulse" />
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
