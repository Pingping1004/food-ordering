import { AuthGuard } from "@/auth/auth.guard";
import { UserRole } from "@/auth/auth.types";

export default function CookerLayout({
    children,
}: {
    children: React.ReactNode
}) {

    return (
        <AuthGuard role={UserRole.cooker}>
            {children}
        </AuthGuard>
    )
}