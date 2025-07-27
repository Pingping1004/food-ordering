"use client";

import React, { createContext, useContext, useCallback, useState, useEffect, useRef, useMemo } from "react";
import { api } from "@/lib/api";
import axios, { AxiosResponse, AxiosRequestConfig } from "axios";
import { useRouter } from "next/navigation";
import { getCsrfToken, setAccessToken, setCsrfToken, clearTokens } from "@/lib/token";
import LoadingPage from "@/components/LoadingPage";

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
    // const isInitialLoad = useRef<boolean>(true);
    // const [accessTokenValue, setAccessTokenValue] = useState<string | null>(null);
    const router = useRouter();

    const isRefreshing = useRef(false);
    const alertShowRef = useRef(false);
    const failedQueue = useRef<FailedRequest[]>([]);

    const isInitialLoad = useRef<boolean>(true);
    const isLoggingOut = useRef<boolean>(false);

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

    const logout = useCallback(async (showAlert: boolean = false) => {
        if (isLoggingOut.current) {
            return;
        }

        setLoading(true);
        try {
            await api.post('/auth/logout', undefined, { headers: { skipAuth: 'true' } });
        } catch { }
        finally {
            handleLogoutSideEffects(showAlert);
            alertShowRef.current = false;
            setLoading(false);
        }
    }, [handleLogoutSideEffects]);

    useEffect(() => {
        if (loading) return;
        const handleSession = async () => {
            const publicRoutes = ['/login', '/signup'];
            const currentPath = window.location.pathname;
            const isPublicRoute = publicRoutes.includes(currentPath);
            const shouldLogout = !user && isAuth === false;

            if (!alertShowRef.current && shouldLogout && !isPublicRoute && !loading) {
                alertShowRef.current = true;
                handleLogoutSideEffects(true);
            }

            if (user && isAuth) {
                alertShowRef.current = false;
            }
        }

        handleSession();
    }, [loading, user, isAuth, handleLogoutSideEffects]);

    const checkSessionValidity = useCallback(async (): Promise<boolean> => {
        try {
            const token = localStorage.getItem('accessToken');
            if (!token) return false;

            const response = await api.get(`/user/profile`, {
                // timeout: 1000,
            });

            return response.status === 200;
        } catch (error) {
            console.error('Session validity check failed:', error);
            return false;
        }
    }, []);

    const getProfile = useCallback(async (): Promise<User> => {
        try {
            const response = await api.get('/user/profile', {
                // timeout: 1000,
            });
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
            localStorage.setItem('accessToken', newAccessToken)

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

        // Response Interceptor: Handle 401 for token refresh
        const handleRefreshToken = async (originalRequest: AxiosRequestConfig) => {
            try {
                const refreshResponse = await api.post('/auth/refresh');
                const newAccessToken = refreshResponse.data.accessToken;

                setAccessToken(newAccessToken);
                localStorage.setItem('accessToken', newAccessToken);

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

                setUser(null);
                setIsAuth(false);
                handleLogoutSideEffects(true);

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

            if (isUnauthorized) {
                console.log('401 Unauthorized detected:', {
                    url: originalRequest.url,
                    method: originalRequest.method,
                    retry: originalRequest._retry,
                    isRefreshing: isRefreshing.current
                });

                // Check if this is a critical endpoint that should immediately force logout
                const criticalEndpoints = ['/user/profile', '/auth/refresh'];
                const isCriticalEndpoint = criticalEndpoints.some(endpoint =>
                    originalRequest.url?.includes(endpoint)
                );

                // If it's a critical endpoint, force logout immediately
                if (isCriticalEndpoint) {
                    console.log('Critical endpoint 401 - forcing immediate logout');
                    setUser(null);
                    setIsAuth(false);
                    handleLogoutSideEffects(true);
                    return Promise.reject(new Error('Session expired'));
                }

                const canRetry = !originalRequest._retry;

                // If this is a retry attempt or refresh is already happening, force logout
                if (!canRetry) {
                    console.log('401 error on retry attempt - forcing logout');
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
                    return handleRefreshToken(originalRequest);
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
                    console.log('Global 401 interceptor - forcing logout');

                    if (!isLoggingOut.current) {
                        setUser(null);
                        setIsAuth(false);
                        handleLogoutSideEffects(true);
                    }
                }
                return Promise.reject(error);
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
                if (!accessToken) {
                    await logout(false);
                    return;
                }

                const isSessionValid = await checkSessionValidity();

                if (!isSessionValid) {
                    setUser(null);
                    setIsAuth(false);
                    handleLogoutSideEffects(true);
                    return;
                }

                setAccessToken(accessToken);

                try {
                    const profileUser = await getProfile();

                    setUser(profileUser);
                    setIsAuth(true);
                    alertShowRef.current = false;

                    const publicRoutes = ['/login', '/signup'];
                    const currentPath = window.location.pathname;
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
                    handleLogoutSideEffects(true);
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