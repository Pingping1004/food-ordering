"use client"

import { useEffect } from "react"
import { useAuth } from "@/auth/auth.hooks"
import { useRouter } from "next/navigation"
import { toastDanger } from "@/components/ui/Toast"
import { UserRole } from "@/auth/auth.types"
import LoadingPage from "@/components/LoadingPage"

interface Props {
  children: React.ReactNode
  role?: UserRole
  optional?: boolean
}

export function AuthGuard({ children, role, optional = false }: Props) {
  const { user, loading, initializing } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return

    // not logged in
    if (!user && !optional) {
      toastDanger("กรุณาล็อกอิน")
      router.push("/login")
      return
    }

    // wrong role
    if (user && role && user.role !== role) {
      router.push("/user/restaurant")
      return
    }

  }, [user, loading, role, optional, router])

  if (loading || initializing) return <LoadingPage />

  return <>{children}</>
}