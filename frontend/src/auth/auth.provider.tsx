"use client"

import { markIntentionalLogout } from "@/auth/logout-intent";
import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { AuthContext } from "@/context/Authcontext"
import { authErrorMessage, getProfileApi, signInApi, signOutApi, signUpApi, type SignupMeta } from "./auth.service"
import { toastError } from "@/components/ui/Toast"
import { useRouter } from "next/navigation"
import { User } from "./auth.types"
import { startInactivityWatcher, stopInactivityWatcher } from "@/lib/inactivity"
import { getSupabase } from "@/lib/supabase/client"

/**
 * Session = Supabase Auth. This provider only mirrors it into React state and attaches our app profile
 * (role + memberships from `GET /user/profile`). Tokens, refresh and persistence are supabase-js's job.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [initializing, setInitializing] = useState(true);
    const [loading, setLoading] = useState(true);
    const userIdRef = useRef<string | null>(null);

    const router = useRouter();

    const applyUser = useCallback((next: User | null) => {
        userIdRef.current = next?.userId ?? null;
        setUser(next);
    }, []);

    const refreshUser = useCallback(async () => {
        try {
            applyUser(await getProfileApi());
        } catch {
            applyUser(null);
        }
    }, [applyUser]);

    const performLogout = useCallback(async (intentional: boolean) => {
        if (intentional) markIntentionalLogout();
        try {
            await signOutApi();
        } finally {
            applyUser(null);
            router.push("/login");
        }
    }, [applyUser, router]);

    /** Called from the sign-out buttons. The inactivity timer below uses `performLogout(false)` so that case still gets the toast. */
    const logout = useCallback(() => performLogout(true), [performLogout]);

    useEffect(() => {
        if (!user) {
            stopInactivityWatcher();
            return;
        }

        startInactivityWatcher({ onLogout: () => { stopInactivityWatcher(); void performLogout(false); }, freshLogin: true });
        return () => stopInactivityWatcher();
    }, [user, performLogout]);

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
            await signInApi(email, password);
            const profile = await getProfileApi();
            applyUser(profile);
            return profile;
        } catch (err: unknown) {
            toastError(authErrorMessage(err), err);
            throw err;
        }
    }, [applyUser]);

    const signup = useCallback(async (email: string, password: string, name?: string, next?: string, extra?: SignupMeta) => {
        try {
            const result = await signUpApi(email, password, name, next, extra);
            if (!result.needsConfirmation) await refreshUser();
            return result;
        } catch (err: unknown) {
            toastError(authErrorMessage(err), err);
            throw err;
        }
    }, [refreshUser]);

    useEffect(() => {
        const supabase = getSupabase();
        let active = true;

        (async () => {
            try {
                const { data } = await supabase.auth.getSession();
                if (data.session) await refreshUser();
            } finally {
                if (active) { setLoading(false); setInitializing(false); }
            }
        })();

        // Keeps tabs in sync (sign-out elsewhere, e-mail-link sign-in, token refresh). Never await supabase calls in here.
        const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === "SIGNED_OUT") return applyUser(null);
            if ((event === "SIGNED_IN" || event === "USER_UPDATED") && session && session.user.id !== userIdRef.current) {
                setTimeout(() => { void refreshUser(); }, 0);
            }
        });

        return () => { active = false; sub.subscription.unsubscribe(); };
    }, [refreshUser, applyUser]);

    const value = useMemo(() => ({
        user,
        isAuth: !!user,
        loading,
        initializing,
        login,
        signup,
        logout,
        refreshUser,
    }), [user, loading, initializing, login, signup, logout, refreshUser])

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}
