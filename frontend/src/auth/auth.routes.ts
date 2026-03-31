import { UserRole } from "./auth.types"

export const protectedRouteRules = [
  { prefix: "/cooker", role: UserRole.cooker },
  { prefix: "/admin", role: UserRole.admin },
]

export function getRouteRequirement(pathname: string) {
  const rule = protectedRouteRules.find(r =>
    pathname.startsWith(r.prefix)
  )

  return {
    requiresAuth: !!rule,
    requiredRole: rule?.role,
  }
}