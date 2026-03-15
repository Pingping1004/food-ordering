"use client";

import React, { createContext, useContext, useCallback, useState, useEffect, useRef, useMemo } from "react";
import { api, handleTokenRefresh } from "@/lib/api";
import axios, { AxiosError } from "axios";
import { useRouter } from "next/navigation";
import { setAccessToken, setCsrfToken, clearTokens, removeAccessToken } from "@/lib/token";
import LoadingPage from "@/components/LoadingPage";
import { toastDanger } from "@/components/ui/Toast";

export enum UserRole {
    user = 'user',
    admin = 'admin',
    cooker = 'cooker',
    guest = 'guest',
}

export type RoleRequestStatus = 'pending' | 'accepted' | 'rejected';

interface RoleRequest {
    requestId: string;
    userId: string;
    requestRole: UserRole;
    status: RoleRequestStatus;
    createdAt: string;
    updatedAt: string | null;
}

interface User {
    userId: string;
    email: string;
    name?: string;
    restaurant?: {
        restaurantId: string;
        isApproved: boolean;
    };
    profileImg?: string;
    role: UserRole.admin | UserRole.cooker | UserRole.user;
    roleRequest?: RoleRequest | null;
}

interface AuthContextType {
    user: User | null;
    isAuth: boolean;
    loading: boolean;
    login: (email: string, password: string) => Promise<User>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [isAuth, setIsAuth] = useState<boolean>(false);
    const router = useRouter();

    const alertShowRef = useRef(false);

    const isInitialLoad = useRef<boolean>(true);
    const isLoggingOut = useRef<boolean>(false);

    const fetchCsrfToken = useCallback(async () => {
        try {
            const result = await api.get('/csrf-token');
            const csrfTokenValue = result.data.csrfToken;
            setCsrfToken(csrfTokenValue);
            return csrfTokenValue;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const message = error.response?.data?.message || error.response?.statusText || 'ไม่พบโทเคน';
                throw new Error(message);
            }
            throw error;
        }
    }, []);

    const checkRouteAuthRequirement = useCallback((pathname: string) => {
        const protectedRouteRules: Array<{ prefix: string; requiredRole?: UserRole }> = [
            { prefix: '/cooker', requiredRole: UserRole.cooker },
            { prefix: '/managed-menu', requiredRole: UserRole.cooker },
            { prefix: '/add-menu', requiredRole: UserRole.cooker },
            { prefix: '/add-menu-bulk', requiredRole: UserRole.cooker },
            { prefix: '/edit-menu', requiredRole: UserRole.cooker },
            { prefix: '/restaurant-register', requiredRole: UserRole.cooker },
            { prefix: '/restaurant/profile', requiredRole: UserRole.cooker },
            { prefix: '/admin', requiredRole: UserRole.admin },
        ];

        const matchedRule = protectedRouteRules.find(rule => pathname.startsWith(rule.prefix));
        const requiresAuth = !!matchedRule;
        const requiredRole = matchedRule?.requiredRole;

        return { requiresAuth, requiredRole };
    }, []);

    const handleLogoutSideEffects = useCallback((showAlert: boolean = false) => {
        if (isLoggingOut.current) {
            return;
        }

        isLoggingOut.current = true;

        localStorage.removeItem('accessToken');
        setIsAuth(false);
        setUser(null);
        clearTokens();

        if (showAlert) {
            toastDanger('เซสชันหมดอายุ กรุณาล็อกอินใหม่อีกครั้ง');
        }

        router.push('/login');

        // Reset the flag after navigation
        setTimeout(() => {
            isLoggingOut.current = false;
        }, 1000);
    }, [router]);


    let refreshTimer: NodeJS.Timeout | null = null;
    const scheduleRefresh = () => {
        if (refreshTimer) clearTimeout(refreshTimer);

        refreshTimer = setTimeout(async () => {
            try {
                await handleTokenRefresh();
                scheduleRefresh();
            } catch {
                handleLogoutSideEffects();
            }
        }, 25 * 60 * 1000);
    };

    const clearRefresh = () => {
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = null;
    };

    const logout = useCallback(async (showAlert: boolean = false) => {
        if (isLoggingOut.current) return

        setLoading(true);
        try {
            await api.post('/auth/logout', undefined, { headers: { skipAuth: 'true' } });
        } finally {
            clearRefresh();
            handleLogoutSideEffects(showAlert);
            alertShowRef.current = false;
            setLoading(false);
        }
    }, [handleLogoutSideEffects, clearRefresh]);

    useEffect(() => {
        if (loading) return;
        const handleSession = async () => {
            const currentPath = window.location.pathname;
            const { requiresAuth, requiredRole } = checkRouteAuthRequirement(currentPath);
            const shouldLogout = !user && requiresAuth;

            if (!alertShowRef.current && shouldLogout) {
                alertShowRef.current = true;
                handleLogoutSideEffects(true);
                return;
            }

            if (requiresAuth && requiredRole && user && user.role !== requiredRole) {
                router.push('/user/restaurant');
                return;
            }

            if (user && isAuth) {
                alertShowRef.current = false;
            }
        }

        handleSession();
    }, [loading, user, isAuth, handleLogoutSideEffects, checkRouteAuthRequirement, router]);

    const checkSessionValidity = useCallback(async (): Promise<boolean> => {
        try {
            const token = localStorage.getItem('accessToken');
            if (!token) return false;

            const response = await api.get(`/user/profile`, {
                // timeout: 1000,
            });

            return response.status === 200;
        } catch {
            return false;
        }
    }, []);

    const getProfile = useCallback(async (): Promise<User> => {
        try {
            const response = await api.get('/user/profile');
            return response.data as User;
        } catch (err) {
            if (axios.isAxiosError(err)) {
                const status = err.response?.status;

                if (status === 401) {
                    throw new Error("โทเคนหมดอายุ");
                }

                if (status === 403) {
                    throw new Error("การเข้าถึงถูกปฏิเสธ");
                }

                if (status === 404) {
                    throw new Error("ไม่พบผู้ใช้งาน");
                }

                // Network or other errors
                if (err.code === 'ECONNABORTED') {
                    throw new Error("เครือข่ายขัดข้อง");
                }
            }

            throw err;
        }
    }, []);

    const getRoleFromAccessToken = (token: string | null): UserRole | undefined => {
        if (!token) return undefined;
        try {
            const parts = token.split('.');
            if (parts.length < 2) return undefined;
            const payloadJson = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
            const payload = JSON.parse(payloadJson) as { role?: string };
            const role = payload.role as UserRole | undefined;
            return role;
        } catch {
            return undefined;
        }
    };

    const getFormattedBackendMessage = (message: string | string[] | undefined): string | undefined => {
        if (!message) {
            return undefined;
        }
        if (typeof message === 'string') {
            return message;
        }
        if (Array.isArray(message)) {
            return message.join(', ');
        }
        return undefined;
    };

    const handleLoginError = useCallback((err: unknown): void => {
        let messageToDisplay: string;

        if (typeof err === 'object' && err !== null && 'response' in err) {
            const error = err as AxiosError<{ message: string }>;
            const status = error.response?.status;
            const backendMessage = getFormattedBackendMessage(error.response?.data.message);

            if (status === 401) {
                messageToDisplay = backendMessage || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
            } else if (status === 403) {
                messageToDisplay = 'เซสชันหมดอายุ กรุณาล็อกอินใหม่อีกครั้ง';
            } else if (status === 404) {
                messageToDisplay = 'ไม่พบบริการหรือเส้นทางที่ร้องขอ';
            } else if (backendMessage) {
                messageToDisplay = backendMessage;
            } else {
                messageToDisplay = 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง';
            }
        } else if (err instanceof Error) {
            messageToDisplay = err.message;
        } else {
            messageToDisplay = 'เกิดข้อผิดพลาดที่ไม่รู้จัก กรุณาลองใหม่';
        }

        toastDanger(messageToDisplay);
    }, []);

    const login = useCallback(async (email: string, password: string): Promise<User> => {
        setLoading(true);
        try {
            const response = await api.post('/auth/login', { email, password }, {
                headers: { skipAuth: 'true' }
            });

            const { accessToken: newAccessToken, user: userData } = response.data;

            if (!newAccessToken || !userData) throw new Error('ไม่พบข้อมูลในการเข้าสู้ระบบ');

            setAccessToken(newAccessToken);
            localStorage.setItem('accessToken', newAccessToken)

            setIsAuth(true);
            setUser(userData as User);
            scheduleRefresh();

            await fetchCsrfToken();
            return userData as User;
        } catch (err: unknown) {
            setTimeout(() => handleLoginError(err), 100);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [fetchCsrfToken]);

    useEffect(() => {
        const initializeAuthAndProfile = async () => {
            setLoading(true);
            try {
                const accessToken = localStorage.getItem('accessToken');
                const currentPath = window.location.pathname;
                const { requiresAuth } = checkRouteAuthRequirement(window.location.pathname);

                if (!accessToken) {
                    if (requiresAuth) {
                        await logout(false);
                        return;
                    } else {
                        setUser(null);
                        setIsAuth(false);
                    }
                    return;
                }

                const isSessionValid = await checkSessionValidity();
                if (!isSessionValid) {
                    setUser(null);
                    setIsAuth(false);
                    handleLogoutSideEffects(true);
                    return;
                }

                if (accessToken) setAccessToken(accessToken);

                try {
                    let profileUser = await getProfile();

                    const roleInToken = getRoleFromAccessToken(localStorage.getItem('accessToken'));
                    if (roleInToken && roleInToken !== profileUser.role) {
                        await handleTokenRefresh();
                        profileUser = await getProfile();
                    }

                    setUser(profileUser);
                    setIsAuth(true);
                    alertShowRef.current = false;
                    await fetchCsrfToken();

                    const publicRoutes = ['/login', '/signup'];
                    const isPublicRoute = publicRoutes.includes(currentPath);

                    if (isInitialLoad.current && isPublicRoute) {
                        if (profileUser.role === UserRole.admin) {
                            router.push('/admin/role-requests');
                        } else if (profileUser.role === UserRole.cooker) {
                            const restaurantId = profileUser.restaurant?.restaurantId;
                            if (restaurantId) {
                                router.push(`/cooker/${restaurantId}`);
                            } else {
                                router.push(`/restaurant-register/${profileUser.userId}`);
                            }
                        } else {
                            router.push('/user/restaurant');
                        }
                    }
                } catch {
                    setUser(null);
                    setIsAuth(false);

                    if (requiresAuth) {
                        handleLogoutSideEffects(true);
                    } else {
                        removeAccessToken();
                        clearTokens();
                    }
                    return;
                }

            } catch {
                setUser(null);
                setIsAuth(false);
                handleLogoutSideEffects(false);
            } finally {
                setLoading(false);
                isInitialLoad.current = false;
            }
        };

        initializeAuthAndProfile();
    }, []);

    useEffect(() => {
        if (alertShowRef.current) {
            const timeout = setTimeout(() => {
                alertShowRef.current = false;
            }, 1000);
            return () => clearTimeout(timeout);
        }
    }, [alertShowRef]);

    const contextValue = useMemo(() => ({
        user,
        isAuth: !!user,
        loading,
        login,
        logout: (showAlert: boolean = false) => logout(showAlert),
    }), [user, isAuth, loading, login, logout]);
    if (loading) return <LoadingPage />
    return (
        <AuthContext.Provider
            value={contextValue}
        >
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined || !context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }

    return context;
}