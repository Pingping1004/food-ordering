"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { AuthContext } from "@/context/Authcontext"
import { loginApi, logoutApi } from "./auth.service"
import { parseLoginErrorMessage } from "./auth.utils"
import { toastDanger } from "@/components/ui/Toast"
import { clearTokens } from "@/lib/token"
import { useRouter } from "next/navigation"
import { checkSessionValidity, initSession } from "./auth.session"
import { User } from "./auth.types"
import { startInactivityWatcher, stopInactivityWatcher } from "@/lib/inactivity"

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [initializing, setInitializing] = useState(true);
    const [loading, setLoading] = useState(true);

    const router = useRouter();

    const handleLoginError = useCallback((err: unknown) => {
        const message = parseLoginErrorMessage(err);
        toastDanger(message)
    }, []);

    const handleLogoutSideEffects = useCallback((showAlert: boolean = false) => {
        localStorage.removeItem('accessToken');
        clearTokens();
        setUser(null);

        if (showAlert) toastDanger('เซสชันหมดอายุ กรุณาล็อกอินใหม่อีกครั้ง');

        router.push('/login');
    }, [router]);

    useEffect(() => {
        if (initializing) return;

        const verify = async () => {
            const token = localStorage.getItem('accessToken');
            if (!token) return

            const isValid = await checkSessionValidity();
            if (!isValid) handleLogoutSideEffects(true)
        };
        verify();
    }, [router, handleLogoutSideEffects, initializing]);

    useEffect(() => {
        if (!user) {
            stopInactivityWatcher();
            return;
        }

        // Only start watching when user is logged in
        startInactivityWatcher({
            onLogout: () => {
                stopInactivityWatcher();
                logout(); // your existing logout function
            },
            tokenExpiresInSeconds: 1800,
        });

        return () => stopInactivityWatcher(); // cleanup on unmount
    }, [user]); // restarts when user logs in/out

    const login = useCallback(async (email: string, password: string): Promise<User> => {
        try {
            const { accessToken, user } = await loginApi(email, password)

            localStorage.setItem("accessToken", accessToken)
            setUser(user)

            return user;
        } catch (err: unknown) {
            handleLoginError(err);
            throw err;
        }
    }, [handleLoginError]);

    const logout = useCallback(async () => {
        await logoutApi()
        handleLogoutSideEffects(true);
    }, [handleLogoutSideEffects]);

    useEffect(() => {
        async function init() {
            try {
                const user = await initSession();
                setUser(user || null);

                if (user) {
                    const isValid = await checkSessionValidity();
                    if (!isValid) handleLogoutSideEffects(true);
                }
            } catch {
                setUser(null)
            } finally {
                setLoading(false)
                setInitializing(false)
            }
        }

        init()
    }, [handleLogoutSideEffects]);

    const value = useMemo(() => ({
        user,
        isAuth: !!user,
        loading,
        initializing,
        login,
        logout
    }), [user, loading, initializing, login, logout])

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}