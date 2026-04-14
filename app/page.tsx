export const revalidate = 60

import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"
import { Hero } from "@/components/sections/Hero"
import { Features } from "@/components/sections/Features"
import { Products } from "@/components/sections/Products"
import { About } from "@/components/sections/About"
import { Testimonials } from "@/components/sections/Testimonials"
import { Contact } from "@/components/sections/Contact"
import { SocialProofStrip } from "@/components/home/SocialProofStrip"
import { CategoryTiles } from "@/components/home/CategoryTiles"
import { TasteQuiz } from "@/components/home/TasteQuiz"
import { FeaturedBlog } from "@/components/home/FeaturedBlog"
import { StickyMobileCTA } from "@/components/home/StickyMobileCTA"

export default function Home() {
  return (
    <>
      <Header />
      <main className="pb-20 md:pb-0">
        <Hero />
        <SocialProofStrip />
        <CategoryTiles />
        <Features />
        <Products />
        <TasteQuiz />
        <About />
        <Testimonials />
        <FeaturedBlog />
        <Contact />
      </main>
      <Footer />
      <StickyMobileCTA />
    </>
  )
}
