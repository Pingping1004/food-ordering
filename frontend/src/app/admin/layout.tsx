import { UserRole } from "@/auth/auth.types"
import { AuthGuard } from "@/auth/auth.guard"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthGuard role={UserRole.admin}>
      {children}
    </AuthGuard>
  )
}