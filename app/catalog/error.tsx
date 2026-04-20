"use client"

import { useEffect } from "react"
import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"

export default function CatalogError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") console.error(error)
  }, [error])

  return (
    <>
      <Header />
      <main className="pt-16">
        <section className="py-16 sm:py-24">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-md">
            <h1 className="font-sans text-2xl sm:text-3xl font-bold mb-3">
              Не удалось загрузить каталог
            </h1>
            <p className="text-muted-foreground mb-6">
              Произошла ошибка при загрузке. Попробуйте обновить страницу.
            </p>
            <button
              onClick={reset}
              className="inline-flex h-11 px-6 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Попробовать снова
            </button>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
