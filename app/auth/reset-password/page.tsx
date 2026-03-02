import { Metadata } from "next"
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm"

export const metadata: Metadata = {
  title: "Восстановление пароля | Millor Coffee",
}

export default function ResetPasswordPage() {
  return <ResetPasswordForm />
}
