import Link from "next/link"
import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"
import { Coffee } from "lucide-react"

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="pt-20 sm:pt-24 pb-16 sm:pb-24 min-h-screen bg-secondary/20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-xl mx-auto text-center py-16 sm:py-24">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Coffee className="w-10 h-10 text-primary" />
            </div>
            <h1 className="font-sans text-3xl sm:text-4xl font-bold mb-3">
              Страница не найдена
            </h1>
            <p className="text-muted-foreground mb-8">
              Возможно, ссылка устарела или вы ошиблись адресом. Ничего страшного —
              выберите что-нибудь ароматное из каталога.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/catalog"
                className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors"
              >
                Перейти в каталог
              </Link>
              <Link
                href="/"
                className="px-6 py-3 border border-border rounded-xl font-medium hover:bg-muted transition-colors"
              >
                На главную
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
