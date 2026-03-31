import { AuthGuard } from "@/auth/auth.guard";
import { MenuProvider } from "@/context/MenuContext";
import { UserRole } from "@/auth/auth.types";
import { CookerProvider } from "@/context/Cookercontext";

export default function CookerLayout({
    children,
}: {
    children: React.ReactNode
}) {

    return (
        <AuthGuard role={UserRole.cooker}>
            <CookerProvider>
                <MenuProvider>
                    {children}
                </MenuProvider>
            </CookerProvider>
        </AuthGuard>
    )
}