import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"
import { Hero } from "@/components/sections/Hero"
import { Features } from "@/components/sections/Features"
import { Products } from "@/components/sections/Products"
import { About } from "@/components/sections/About"
import { Testimonials } from "@/components/sections/Testimonials"
import { Contact } from "@/components/sections/Contact"

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Features />
        <Products />
        <About />
        <Testimonials />
        <Contact />
      </main>
      <Footer />
    </>
  )
}
