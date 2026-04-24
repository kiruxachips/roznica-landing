import { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Регистрация завершена | Millor Coffee",
  robots: { index: false, follow: false },
}

// Страница не используется: RegisterForm делает auto-login и push("/wholesale").
// Оставлен redirect на dashboard на случай, если кто-то зайдёт по старой ссылке.
export default function WholesaleRegisterSuccessPage() {
  redirect("/wholesale")
}
