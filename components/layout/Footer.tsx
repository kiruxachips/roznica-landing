import Link from "next/link"
import Image from "next/image"
import { Send, Phone, Mail } from "lucide-react"
import { SHOP_URL, navigation } from "@/lib/constants"

// VK icon component
function VKIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.408 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.864-.525-2.05-1.727-1.033-1-1.49-1.135-1.744-1.135-.356 0-.458.102-.458.593v1.575c0 .424-.135.678-1.253.678-1.846 0-3.896-1.118-5.335-3.202C4.624 10.857 4.03 8.57 4.03 8.096c0-.254.102-.491.593-.491h1.744c.44 0 .61.203.78.677.863 2.49 2.303 4.675 2.896 4.675.22 0 .322-.102.322-.66V9.721c-.068-1.186-.695-1.287-.695-1.71 0-.204.17-.407.44-.407h2.744c.373 0 .508.203.508.643v3.473c0 .372.17.508.271.508.22 0 .407-.136.813-.542 1.254-1.406 2.151-3.574 2.151-3.574.119-.254.322-.491.763-.491h1.744c.525 0 .644.27.525.643-.22 1.017-2.354 4.031-2.354 4.031-.186.305-.254.44 0 .78.186.254.796.779 1.203 1.253.745.847 1.32 1.558 1.473 2.05.17.49-.085.744-.576.744z"/>
    </svg>
  )
}

export function Footer() {
  // Фиксированный год для избежания hydration mismatch
  const currentYear = 2026

  return (
    <footer className="bg-coffee-900 text-white relative overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center mb-4">
              <Image
                src="/images/logo.webp"
                alt="Millor Coffee"
                width={125}
                height={50}
                className="brightness-0 invert"
              />
            </Link>
            <p className="text-coffee-300 text-sm max-w-md mb-6">
              Свежеобжаренный премиальный кофе из лучших плантаций мира.
              Обжариваем под каждый заказ и доставляем по всей России.
            </p>
            {/* Social Links */}
            <div className="flex gap-3">
              <a
                href="https://t.me/coffeemillor"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                aria-label="Telegram"
              >
                <Send className="w-5 h-5" />
              </a>
              <a
                href="https://vk.com/coffeemillor"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                aria-label="VKontakte"
              >
                <VKIcon className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="font-semibold mb-4">Навигация</h3>
            <ul className="space-y-2">
              {navigation.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-coffee-300 hover:text-white text-sm transition-colors"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
              <li>
                <a
                  href={SHOP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-coffee-300 hover:text-white text-sm transition-colors"
                >
                  Магазин
                </a>
              </li>
            </ul>
          </div>

          {/* Contacts */}
          <div>
            <h3 className="font-semibold mb-4">Контакты</h3>
            <ul className="space-y-3">
              <li>
                <a
                  href="tel:+74012375343"
                  className="flex items-center gap-2 text-coffee-300 hover:text-white text-sm transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  +7 (401) 237 53 43
                </a>
              </li>
              <li>
                <a
                  href="mailto:Import@kldrefine.com"
                  className="flex items-center gap-2 text-coffee-300 hover:text-white text-sm transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  Import@kldrefine.com
                </a>
              </li>
            </ul>
            <p className="text-coffee-400 text-xs mt-4">
              Пн-Пт: 9:00 - 18:00
            </p>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-white/10 mt-10 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-coffee-400 text-sm">
            © {currentYear} Millor Coffee. Все права защищены.
          </p>
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6 text-sm">
            <Link
              href="/privacy"
              className="text-coffee-400 hover:text-white transition-colors"
            >
              Политика конфиденциальности
            </Link>
            <Link
              href="/terms"
              className="text-coffee-400 hover:text-white transition-colors"
            >
              Пользовательское соглашение
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
