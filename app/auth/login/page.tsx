import { Metadata } from "next"
import { Suspense } from "react"
import { LoginForm } from "@/components/auth/LoginForm"

export const metadata: Metadata = {
  title: "Вход | Millor Coffee",
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
