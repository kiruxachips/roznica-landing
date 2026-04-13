"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Menu, X } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { CartButton } from "@/components/cart/CartButton"
import { CartDrawer } from "@/components/cart/CartDrawer"
import { UserMenu } from "@/components/layout/UserMenu"
import { cn } from "@/lib/utils"
import { useCartUIStore } from "@/lib/store/cart-ui"

const navigation = [
  { name: "Каталог", href: "/catalog" },
  { name: "Блог", href: "/blog" },
  { name: "О нас", href: "/#about" },
  { name: "Отзывы", href: "/#testimonials" },
]

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const cartOpen = useCartUIStore((s) => s.drawerOpen)
  const openCart = useCartUIStore((s) => s.openDrawer)
  const closeCart = useCartUIStore((s) => s.closeDrawer)

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-md border-b border-border">
        <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center group">
              <Image
                src="/images/logo.webp"
                alt="Millor Coffee"
                width={125}
                height={50}
                className="transition-transform group-hover:scale-105"
              />
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex md:items-center md:gap-8">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                >
                  {item.name}
                </Link>
              ))}
            </div>

            {/* CTA + Cart + User */}
            <div className="hidden md:flex md:items-center gap-1.5 lg:gap-2">
              <UserMenu />
              <CartButton onClick={openCart} />
              <Link
                href="/catalog"
                className={cn(buttonVariants({ size: "lg" }), "ml-2")}
              >
                В каталог
              </Link>
            </div>

            {/* Mobile: user + cart + menu */}
            <div className="md:hidden flex items-center gap-1">
              <UserMenu />
              <CartButton onClick={openCart} />
              <button
                type="button"
                className="inline-flex items-center justify-center w-10 h-10 rounded-xl text-foreground hover:bg-muted transition-colors"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                <span className="sr-only">Открыть меню</span>
                {mobileMenuOpen ? <X className="w-5 h-5" strokeWidth={1.75} /> : <Menu className="w-5 h-5" strokeWidth={1.75} />}
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          <div
            className={cn(
              "md:hidden overflow-hidden transition-all duration-300",
              mobileMenuOpen ? "max-h-80 pb-4" : "max-h-0"
            )}
          >
            <div className="flex flex-col gap-2 pt-2">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="text-base font-medium text-muted-foreground hover:text-primary py-2 transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.name}
                </Link>
              ))}
              <Link
                href="/catalog"
                className={cn(buttonVariants({ size: "lg" }), "mt-2 w-full flex items-center justify-center")}
                onClick={() => setMobileMenuOpen(false)}
              >
                В каталог
              </Link>
            </div>
          </div>
        </nav>
      </header>

      <CartDrawer isOpen={cartOpen} onClose={closeCart} />
    </>
  )
}
