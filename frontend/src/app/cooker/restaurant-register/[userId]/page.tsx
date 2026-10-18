"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/auth/auth.guard";
import { useAuth } from "@/auth/auth.hooks";
import { RegisterWizard } from "@/components/cookers/RegisterWizard";

/**
 * 4-step restaurant registration. Any signed-in user can apply – the school (not the platform admin)
 * approves the restaurant, so the old "must be an approved cooker first" gate is gone.
 */
function Register() {
    const { user } = useAuth();
    const router = useRouter();

    useEffect(() => {
        const existing = user?.restaurant?.restaurantId;
        if (existing) router.replace(`/cooker/${existing}`);
    }, [user, router]);

    return <RegisterWizard />;
}

export default function RestaurantRegisterPage() {
    return (
        <AuthGuard>
            <Register />
        </AuthGuard>
    );
}
