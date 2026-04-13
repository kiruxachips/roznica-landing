import Link from "next/link"
import Image from "next/image"
import { Send, Phone, Mail } from "lucide-react"
import { SHOP_URL } from "@/lib/constants"

const navigation = [
  { name: "Каталог", href: "/catalog" },
  { name: "Блог", href: "/blog" },
  { name: "О нас", href: "/#about" },
  { name: "Отзывы", href: "/#testimonials" },
]

// VK icon component
function VKIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.408 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.864-.525-2.05-1.727-1.033-1-1.49-1.135-1.744-1.135-.356 0-.458.102-.458.593v1.575c0 .424-.135.678-1.253.678-1.846 0-3.896-1.118-5.335-3.202C4.624 10.857 4.03 8.57 4.03 8.096c0-.254.102-.491.593-.491h1.744c.44 0 .61.203.78.677.863 2.49 2.303 4.675 2.896 4.675.22 0 .322-.102.322-.66V9.721c-.068-1.186-.695-1.287-.695-1.71 0-.204.17-.407.44-.407h2.744c.373 0 .508.203.508.643v3.473c0 .372.17.508.271.508.22 0 .407-.136.813-.542 1.254-1.406 2.151-3.574 2.151-3.574.119-.254.322-.491.763-.491h1.744c.525 0 .644.27.525.643-.22 1.017-2.354 4.031-2.354 4.031-.186.305-.254.44 0 .78.186.254.796.779 1.203 1.253.745.847 1.32 1.558 1.473 2.05.17.49-.085.744-.576.744z"/>
    </svg>
  )
}

export function Footer() {
  const currentYear = 2026

  return (
    <footer className="bg-coffee-900 text-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Top row */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 lg:gap-8">
          {/* Logo + socials */}
          <div className="flex items-center justify-between lg:justify-start gap-5">
            <Link href="/" className="flex items-center shrink-0">
              <Image
                src="/images/logo.webp"
                alt="Millor Coffee"
                width={110}
                height={44}
                className="brightness-0 invert"
              />
            </Link>
            <div className="flex gap-2">
              <a
                href="https://t.me/coffeemillor"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Telegram"
                className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <Send className="w-4 h-4" />
              </a>
              <a
                href="https://vk.com/coffeemillor"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="VKontakte"
                className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <VKIcon className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="text-coffee-300 hover:text-white transition-colors"
              >
                {item.name}
              </Link>
            ))}
            <a
              href={SHOP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-coffee-300 hover:text-white transition-colors"
            >
              Магазин
            </a>
          </nav>

          {/* Contacts */}
          <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row flex-wrap gap-x-5 gap-y-1.5 text-sm">
            <a
              href="tel:+74012375343"
              className="flex items-center gap-1.5 text-coffee-300 hover:text-white transition-colors"
            >
              <Phone className="w-3.5 h-3.5 shrink-0" />
              +7 (401) 237 53 43
            </a>
            <a
              href="mailto:Import@kldrefine.com"
              className="flex items-center gap-1.5 text-coffee-300 hover:text-white transition-colors"
            >
              <Mail className="w-3.5 h-3.5 shrink-0" />
              Import@kldrefine.com
            </a>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-white/10 mt-5 pt-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 text-xs text-coffee-400">
          <p>© {currentYear} Millor Coffee · Пн-Пт 9:00-18:00</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/privacy" className="hover:text-white transition-colors">
              Политика конфиденциальности
            </Link>
            <Link href="/terms" className="hover:text-white transition-colors">
              Пользовательское соглашение
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
