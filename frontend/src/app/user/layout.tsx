import { CartProvider } from "@/context/CartContext";
import { AuthGuard } from "@/auth/auth.guard";

export default function UserLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <>
            <link rel="preconnect" href="https://images.promptserve.online" />
            <link rel="preconnect" href={process.env.NEXT_PUBLIC_API_URL} />

            <AuthGuard optional>
                <CartProvider>
                    {children}
                </CartProvider>
            </AuthGuard>
        </>
    )
}