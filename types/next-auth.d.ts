import "next-auth"
import "next-auth/jwt"

type UserType = "admin" | "customer" | "wholesale"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email?: string | null
      name?: string | null
      image?: string | null
      userType: UserType
      role?: string
      status?: string
      // Wholesale-only
      companyId?: string
      companyStatus?: string
    }
  }

  interface User {
    id?: string
    email?: string | null
    name?: string | null
    image?: string | null
    userType?: UserType
    role?: string
    status?: string
    companyId?: string
    companyStatus?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userType?: UserType
    role?: string
    status?: string
    companyId?: string
    companyStatus?: string
  }
}
