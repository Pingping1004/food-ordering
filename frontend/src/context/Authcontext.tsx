"use client";

import React, { createContext, useContext, useCallback, useState, useEffect, useRef, useMemo } from "react";
import { api, handleTokenRefresh, normalizeError } from "@/lib/api";
import axios, { AxiosResponse, AxiosRequestConfig } from "axios";
import { useRouter } from "next/navigation";
import { getCsrfToken, setAccessToken, setCsrfToken, clearTokens, removeAccessToken } from "@/lib/token";
import LoadingPage from "@/components/LoadingPage";

export enum UserRole {
    user = 'user',
    admin = 'admin',
    cooker = 'cooker',
    guest = 'guest',
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
}

interface AuthContextType {
    user: User | null;
    isAuth: boolean;
    loading: boolean;
    login: (email: string, password: string) => Promise<User>;
    logout: () => Promise<void>;
}

// Extend the config type
interface CustomAxiosRequestConfig extends AxiosRequestConfig {
    _retry?: boolean;
}

type FailedRequest = {
    resolve: (value: AxiosResponse | PromiseLike<AxiosResponse>) => void;
    reject: (reason?: unknown) => void;
    config: AxiosRequestConfig;
};

interface BackendErrorResponse {
    statusCode: number;
    message: string | string[];
    error: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [isAuth, setIsAuth] = useState<boolean>(false);
    // const isInitialLoad = useRef<boolean>(true);
    // const [accessTokenValue, setAccessTokenValue] = useState<string | null>(null);
    const router = useRouter();

    const isRefreshing = useRef(false);
    const alertShowRef = useRef(false);
    const failedQueue = useRef<FailedRequest[]>([]);
    const reroutingToLoginRef = useRef<boolean>(false);

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
                const message = error.response?.data?.message || error.response?.statusText || 'Failed to fetch CSRF token';
                throw new Error(message);
            }
            throw error;
        }
    }, []);

    const checkRouteAuthRequirement = useCallback((pathname: string, userRole?: UserRole) => {
        const protectedRoutes = [
            '/cooker', // All cooker routes require auth
            '/restaurant',
            '/managed-menu',
            '/add-menu',
            '/add-menu-bulk',
            '/edit-menu',
            '/restaurant-register' // User must login before registering restaurant
        ];

        const requiresAuth = protectedRoutes.some(route => pathname.startsWith(route));
        const cookerNeedsAuth = protectedRoutes.some(route => pathname.startsWith(route)) &&
            (!userRole || userRole === UserRole.cooker);

        return { requiresAuth, cookerNeedsAuth };
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
            alert('เซสชันหมดอายุ กรุณาล็อกอินใหม่อีกครั้ง');
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
    }, [handleLogoutSideEffects]);

    useEffect(() => {
        if (loading) return;
        const handleSession = async () => {
            const currentPath = window.location.pathname;
            const { requiresAuth, cookerNeedsAuth } = checkRouteAuthRequirement(currentPath, user?.role);
            const shouldLogout = !user && requiresAuth;

            if (!alertShowRef.current && shouldLogout) {
                alertShowRef.current = true;
                handleLogoutSideEffects(true);
                return;
            }

            if (cookerNeedsAuth && (!user || user.role !== UserRole.cooker)) {
                if (!reroutingToLoginRef.current) {
                    reroutingToLoginRef.current = true;
                    router.push('/login');
                }
                return;
            }

            if (user && isAuth) {
                alertShowRef.current = false;
            }
        }

        handleSession();
    }, [loading, user, isAuth, handleLogoutSideEffects, checkRouteAuthRequirement]);

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
                    throw new Error("Unauthorized - Token expired");
                }

                if (status === 403) {
                    throw new Error("Forbidden - Access denied");
                }

                if (status === 404) {
                    throw new Error("User not found");
                }

                // Network or other errors
                if (err.code === 'ECONNABORTED') {
                    throw new Error("Request timeout");
                }
            }

            throw err;
        }
    }, []);

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

        if (axios.isAxiosError(err)) {
            const status = err.response?.status;
            const backendData = err.response?.data as BackendErrorResponse;
            const backendMessage = getFormattedBackendMessage(backendData?.message);

            if (status === 401) {
                // For 401, prioritize backend's specific message (if any), otherwise use generic for security.
                messageToDisplay = backendMessage || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
            } else if (status === 403) {
                // HTTP 403 Forbidden (e.g., session expired, access denied)
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

        alert(messageToDisplay);
    }, []);

    const login = useCallback(async (email: string, password: string): Promise<User> => {
        setLoading(true);
        try {
            const response = await api.post('/auth/login', { email, password }, {
                headers: { skipAuth: 'true' }
            });

            const { accessToken: newAccessToken, user: userData } = response.data;

            if (!newAccessToken || !userData) {
                throw new Error('Login response missing access token or user data.');
            }

            setAccessToken(newAccessToken);
            localStorage.setItem('accessToken', newAccessToken)

            setIsAuth(true);
            setUser(userData as User);
            scheduleRefresh();

            await fetchCsrfToken();
            return userData as User;
        } catch (err: unknown) {
            handleLoginError(err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [fetchCsrfToken]);

    useEffect(() => {
        const requestInterceptor = api.interceptors.request.use(
            async (config) => {
                if (config.headers?.skipAuth === 'true') return config;

                const token = localStorage.getItem('accessToken');
                if (token && config.headers && !config.headers.Authorization) {
                    config.headers.Authorization = `Bearer ${token}`;
                }

                const currentCsrfToken = getCsrfToken();
                if (currentCsrfToken && config.headers) {
                    const isCsrfFetchRequest = config.url === '/csrf-token';
                    const isMutatingMethod = ['post', 'put', 'delete', 'patch'].includes(config.method?.toLowerCase() || '');

                    if (!isCsrfFetchRequest && isMutatingMethod) {
                        if (!config.headers['X-CSRF-TOKEN']) {
                            config.headers['X-CSRF-TOKEN'] = currentCsrfToken;
                        }
                    }
                }

                config.withCredentials = true;
                return config;
            },
            (error) => {
                return Promise.reject(error instanceof Error ? error : new Error(JSON.stringify(error)))
            }
        );

        const queueRequest = (originalRequest: AxiosRequestConfig) =>
            new Promise((resolve, reject) => {
                failedQueue.current.push({ resolve, reject, config: originalRequest });
            });

        const onResponseError = async (error: unknown) => {
            if (!axios.isAxiosError(error) || !error.config) {
                return Promise.reject(new Error('Unknown error'));
            }

            const originalRequest = error.config as CustomAxiosRequestConfig;
            const isUnauthorized = error.response?.status === 401;

            if (isUnauthorized) {
                // Check if this is a critical endpoint that should immediately force logout
                const criticalEndpoints = ['/user/profile', '/auth/refresh'];
                const isCriticalEndpoint = criticalEndpoints.some(endpoint =>
                    originalRequest.url?.includes(endpoint)
                );

                // If it's a critical endpoint, force logout immediately
                if (isCriticalEndpoint) {
                    setUser(null);
                    setIsAuth(false);
                    handleLogoutSideEffects(true);
                    return Promise.reject(new Error('Session expired'));
                }

                const canRetry = !originalRequest._retry;

                // If this is a retry attempt or refresh is already happening, force logout
                if (!canRetry) {
                    setUser(null);
                    setIsAuth(false);
                    handleLogoutSideEffects(true);
                    return Promise.reject(new Error('Session expired'));
                }

                // Mark as retry to prevent infinite loops
                originalRequest._retry = true;

                // Try token refresh only once
                if (!isRefreshing.current) {
                    isRefreshing.current = true;
                    return handleTokenRefresh(originalRequest);
                } else {
                    // If refresh is already in progress, queue the request
                    return queueRequest(originalRequest);
                }
            }

            return Promise.reject(
                error instanceof Error ? error : new Error(JSON.stringify(error))
            );
        };

        const responseInterceptor = api.interceptors.response.use(
            (response) => response,
            onResponseError
        );

        const globalUnauthorizedInterceptor = api.interceptors.response.use(
            (response) => response,
            (error) => {
                if (axios.isAxiosError(error) && error.response?.status === 401) {
                    // If we get here, it means the first interceptor didn't handle it properly

                    if (!isLoggingOut.current) {
                        setUser(null);
                        setIsAuth(false);
                        handleLogoutSideEffects(true);
                    }
                }
                return Promise.reject(normalizeError(error));
            }
        );

        return () => {
            api.interceptors.request.eject(requestInterceptor);
            api.interceptors.response.eject(responseInterceptor);
            api.interceptors.response.eject(globalUnauthorizedInterceptor);
        };
    }, []);


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

                if (!requiresAuth) {
                    try {
                        setAccessToken(accessToken);
                        const profileUser = await getProfile();
                        setUser(profileUser);
                        setIsAuth(true);
                        alertShowRef.current = true;
                    } catch {
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
                    const profileUser = await getProfile();

                    setUser(profileUser);
                    setIsAuth(true);
                    alertShowRef.current = false;

                    const publicRoutes = ['/login', '/signup'];
                    const isPublicRoute = publicRoutes.includes(currentPath);

                    if (isInitialLoad.current && isPublicRoute) {
                        const routePath = profileUser.role === UserRole.cooker
                            ? `cooker/${profileUser.restaurant?.restaurantId}`
                            : 'user/restaurant';
                        router.push(`/${routePath}`);
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