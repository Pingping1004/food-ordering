"use client"

import { useEffect } from "react"
import { useAuth } from "@/auth/auth.hooks"
import { useRouter } from "next/navigation"
import { toastDanger } from "@/components/ui/Toast"
import { UserRole, type User } from "@/auth/auth.types"
import { hasRole, postLoginPath } from "@/auth/access"
import { wasIntentionalLogout } from "@/auth/logout-intent"
import LoadingPage from "@/components/LoadingPage"

interface Props {
  children: React.ReactNode
  role?: UserRole
  /** Membership-based check (preferred over `role` for school / restaurant areas). */
  allow?: (user: User) => boolean
  /** Where to send a signed-in user who fails `role` / `allow` (default: their own role home). */
  fallback?: string | ((user: User) => string)
  optional?: boolean
  /**
   * Paint the page while auth is still resolving instead of a full-screen spinner. Only for areas whose data the API
   * already protects and whose chrome is user-independent; redirects still happen once auth resolves.
   */
  optimistic?: boolean
}

export function AuthGuard({ children, role, allow, fallback = postLoginPath, optional = false, optimistic = false }: Props) {
  const { user, loading, initializing } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading || initializing) return

    // not logged in
    if (!user && !optional) {
      // Stay quiet after a deliberate sign-out; expired sessions and everything else still explain themselves.
      if (!wasIntentionalLogout()) toastDanger("กรุณาเข้าสู่ระบบก่อน", "ต้องเข้าสู่ระบบจึงจะใช้งานหน้านี้ได้")
      router.push("/login")
      return
    }

    // wrong role
    if (user && ((role && !hasRole(user, role)) || (allow && !allow(user)))) {
      router.push(typeof fallback === "function" ? fallback(user) : fallback)
      return
    }

  }, [user, loading, role, allow, fallback, optional, router, initializing])

  if ((loading || initializing) && !optimistic) return <LoadingPage />

  return <>{children}</>
}