"use client";

import { CartProvider } from "@/context/CartContext";
import { StudentAppFrame } from "@/components/users/StudentAppFrame";
import { AuthGuard } from "@/auth/auth.guard";
import { approvedSchoolIds, hasSchool, isSystemAdmin, postLoginPath } from "@/auth/access";
import type { User } from "@/auth/auth.types";

/** Ordering needs a login (no guests) and a school: anyone who has not joined one is sent through /onboarding. */
const canOrder = (user: User) => isSystemAdmin(user) || hasSchool(user) || approvedSchoolIds(user).length > 0;

export default function UserLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <>
            <link rel="preconnect" href="https://images.promptserve.online" />
            {process.env.NEXT_PUBLIC_API_URL && (
                <link rel="preconnect" href={process.env.NEXT_PUBLIC_API_URL} />
            )}

            <AuthGuard allow={canOrder} fallback={postLoginPath}>
                <CartProvider>
                    <StudentAppFrame>{children}</StudentAppFrame>
                </CartProvider>
            </AuthGuard>
        </>
    )
}
