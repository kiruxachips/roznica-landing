import { Metadata } from "next"
import { RegisterForm } from "@/components/auth/RegisterForm"

export const metadata: Metadata = {
  title: "Регистрация | Millor Coffee",
}

export default function RegisterPage() {
  return <RegisterForm />
}
