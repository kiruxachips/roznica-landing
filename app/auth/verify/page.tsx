import { Metadata } from "next"
import { Suspense } from "react"
import { VerifyCodeForm } from "@/components/auth/VerifyCodeForm"

export const metadata: Metadata = {
  title: "Подтверждение email | Millor Coffee",
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyCodeForm />
    </Suspense>
  )
}
