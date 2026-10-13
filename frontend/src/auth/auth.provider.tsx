"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { AuthContext } from "@/context/Authcontext"
import { loginApi, logoutApi } from "./auth.service"
import { parseLoginErrorMessage } from "./auth.utils"
import { toastDanger } from "@/components/ui/Toast"
import { clearTokens } from "@/lib/token"
import { useRouter } from "next/navigation"
import { initSession } from "./auth.session"
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

    const handleLogoutSideEffects = useCallback(({ showAlert = false, redirectUrl = '' }: { showAlert?: boolean; redirectUrl?: string } = {}) => {
        clearTokens();
        setUser(null);

        if (showAlert) toastDanger('เซสชันหมดอายุ กรุณาล็อกอินใหม่อีกครั้ง');

        if (redirectUrl) router.push(redirectUrl);
    }, [router]);

    const logout = useCallback(async () => {
        try {
            await logoutApi();
        } finally {
            handleLogoutSideEffects({ showAlert: false, redirectUrl: '/login' });
        }
    }, [handleLogoutSideEffects]);

    useEffect(() => {
        if (!user) {
            stopInactivityWatcher();
            return;
        }

        startInactivityWatcher({
            onLogout: () => {
                stopInactivityWatcher();
                logout();
            },
            freshLogin: true,
        });

        return () => {
            stopInactivityWatcher();
        };
    }, [user, logout, handleLogoutSideEffects]);

    useEffect(() => {
        const audio = new Audio("/sounds/notification.mp3");
        audio.preload = "auto";
    
        let lastPlayedAt = 0;
    
        const playSound = () => {
            const now = Date.now();
            if (now - lastPlayedAt < 3000) return;
            lastPlayedAt = now;
    
            audio.currentTime = 0;
            audio.play().catch(() => {});
        };
    
        const handleSWMessage = (e: MessageEvent) => {
            if (e.data?.type === "PLAY_NOTIFICATION_SOUND") playSound();
        };
    
        navigator.serviceWorker?.addEventListener("message", handleSWMessage);
    
        return () => {
            navigator.serviceWorker?.removeEventListener("message", handleSWMessage);
        };
    }, []);

    const login = useCallback(async (email: string, password: string): Promise<User> => {
        try {
            const { user } = await loginApi(email, password)

            setUser(user)

            return user;
        } catch (err: unknown) {
            handleLoginError(err);
            throw err;
        }
    }, [handleLoginError]);

    useEffect(() => {
        async function init() {
            try {
                const user = await initSession();
                setUser(user || null);
            } catch {
                setUser(null)
            } finally {
                setLoading(false)
                setInitializing(false)
            }
        }

        init()
    }, []);

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