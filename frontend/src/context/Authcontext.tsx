"use client";

import React, { createContext, useContext, useCallback, useState, useEffect, useRef, useMemo } from "react";
import { api } from "@/lib/api";
import axios, { AxiosResponse, AxiosRequestConfig, isAxiosError } from "axios";
import { useRouter } from "next/navigation";
import { getCsrfToken, setAccessToken, setCsrfToken, clearTokens } from "@/lib/token";

export enum UserRole {
    user = 'user',
    admin = 'admin',
    cooker = 'cooker',
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
    accessTokenValue: string | null;
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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [isAuth, setIsAuth] = useState<boolean>(false);
    const [accessTokenValue, setAccessTokenValue] = useState<string | null>(null);
    const router = useRouter();

    const isRefreshing = useRef(false);
    const alertShowRef = useRef(false);
    const failedQueue = useRef<FailedRequest[]>([]);

    const processQueue = useCallback(
        (error: Error | null, token: string | null = null) => {
            failedQueue.current.forEach((prom) => {
                if (error) {
                    prom.reject(error);
                } else if (token) {
                    // Ensure headers exist and are mutable
                    prom.config.headers = {
                        ...(prom.config.headers || {}),
                        Authorization: `Bearer ${token}`,
                    };

                    prom.resolve(api(prom.config));
                }
            });

            // Clear the queue
            failedQueue.current = [];
        },
        []
    );

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

    const logout = useCallback(async (redirectImmediately: boolean = true) => {
        setLoading(true);
        try {
            await api.post('/auth/logout', undefined, { headers: { skipAuth: 'true' } });
        } catch {
            throw new Error('Logout failed');
        } finally {
            handleLogoutSideEffects();
            setLoading(false);
            alertShowRef.current = false;

            if (redirectImmediately) {
                router.push('/login');
            }
        }
    }, [router]);

    const handleLogoutSideEffects = () => {
        setUser(null);
        setIsAuth(false);
        setAccessTokenValue(null);
        clearTokens();
        localStorage.removeItem('accessToken');
    };

    useEffect(() => {
        if (loading) return;
        const handleSession = async () => {
            const publicRoutes = ['/login', '/signup'];
            const currentPath = window.location.pathname;
            const isPublicRoute = publicRoutes.includes(currentPath);
            const shouldLogout = !user && isAuth === false;

            if (!alertShowRef.current && shouldLogout && !isPublicRoute) {
                alertShowRef.current = true;
                alert('เซสชันหมดอายุ กรุณาล็อกอินใหม่อีกครั้ง');
                await logout(true);
            }

            if (user && isAuth) {
                alertShowRef.current = false;
            }
        }

        handleSession();
    }, [loading, user, router, isAuth, logout]);

    const getProfile = useCallback(async (): Promise<User> => {
        try {
            const response = await api.get('/user/profile');
            return response.data as User;
        } catch (err) {
            if (axios.isAxiosError(err) && err.response?.status === 401) {
                throw new Error("Unauthorized");
            }
            throw err;
        }
    }, []);

    function handleLoginError(err: unknown): void {
        if (axios.isAxiosError(err)) {
            const status = err.response?.status;

            if (status === 401) {
                alert('รหัสผ่านหรืออีเมลไม่ถูกต้อง');
                return;
            }

            if (status === 404) {
                alert('ไม่พบบัญชีผู้ใช้นี้');
                return;
            }

            if (status === 403) {
                alert('เซสชันหมดอายุ กรุณาล็อกอินใหม่อีกครั้ง');
                return;
            }

            // fallback if status doesn't match
            alert(err.response?.data?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
        } else {
            alert('เกิดข้อผิดพลาดที่ไม่รู้จัก กรุณาลองใหม่');
        }
    }

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
            setAccessTokenValue(newAccessToken)
            localStorage.setItem('accessToken', newAccessToken);

            setIsAuth(true);
            setUser(userData as User);

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

                if (accessTokenValue && config.headers && !config.headers.Authorization) {
                    config.headers.Authorization = `Bearer ${accessTokenValue}`;
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

        // Response Interceptor: Handle 401 for token refresh
        const handleRefreshToken = async (originalRequest: AxiosRequestConfig) => {
            try {
                const refreshResponse = await api.post('/auth/refresh');
                const newAccessToken = refreshResponse.data.accessToken;

                setAccessToken(newAccessToken);
                setAccessTokenValue(newAccessToken);

                const user = await getProfile();
                setUser(user);
                setIsAuth(true);

                processQueue(null, newAccessToken);

                originalRequest.headers ??= {};
                originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

                return api(originalRequest);
            } catch (refreshError) {
                let normalizedError: Error;

                if (refreshError instanceof Error) {
                    normalizedError = refreshError;
                } else if (typeof refreshError === 'string') {
                    normalizedError = new Error(refreshError);
                } else {
                    try {
                        normalizedError = new Error(JSON.stringify(refreshError));
                    } catch {
                        normalizedError = new Error('Unknown error during token refresh');
                    }
                }

                processQueue(normalizedError);
                await logout();
                throw normalizedError;
            } finally {
                isRefreshing.current = false;
            }
        };

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
            const canRetry = !originalRequest._retry;

            if (isUnauthorized && canRetry) {
                originalRequest._retry = true;

                if (!isRefreshing.current) {
                    isRefreshing.current = true;
                    return handleRefreshToken(originalRequest);
                } else {
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

        return () => {
            api.interceptors.request.eject(requestInterceptor);
            api.interceptors.response.eject(responseInterceptor);
        };
    }, [accessTokenValue, processQueue, logout, getProfile]);

    useEffect(() => {
        const initializeAuthAndProfile = async () => {
            setLoading(true);
            try {
                const accessToken = localStorage.getItem('accessToken');
                if (!accessToken) throw new Error('Access token missing');

                setAccessTokenValue(accessToken);

                const profileUser = await getProfile();

                setUser(profileUser);
                setIsAuth(true);
                alertShowRef.current = false;

                const routePath = profileUser.role === UserRole.cooker
                    ? `cooker/${profileUser.restaurant?.restaurantId}`
                    : 'user/restaurant';
                router.push(`/${routePath}`);
            } catch (err: unknown) {
                setUser(null);
                setIsAuth(false);

                if (isAxiosError(err)) {
                    const status = err.response?.status;

                    if (status === 401) {
                        alert('เซสชันหมดอายุ กรุณาล็อกอินใหม่อีกครั้ง');
                        await logout(true);
                        return;
                    }

                    if (status === 404) {
                        alert('ไม่พบบัญชีผู้ใช้นี้');
                        return;

                    }
                    if (status === 403) {
                        alert('ไม่มีสิทธิ์เข้าใช้งานหน้านี้');
                        return;
                    }

                    alert('เกิดข้อผิดพลาด กรุณาลองใหม่');
                    alertShowRef.current = true;
                } else {
                    console.error('Unexpected error: ', err);
                }
            } finally {
                setLoading(false);
            }
        };
        
        initializeAuthAndProfile();
    }, [logout, router, getProfile]);

    useEffect(() => {
        if (alertShowRef.current) {
            const timeout = setTimeout(() => {
                alertShowRef.current = false;
            }, 3000);
            return () => clearTimeout(timeout);
        }
    }, [alertShowRef]);

    const contextValue = useMemo(() => ({
        user,
        accessTokenValue,
        isAuth: !!user,
        loading,
        login,
        logout,
    }), [user, accessTokenValue, isAuth, loading, login, logout]);
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