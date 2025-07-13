"use client";

import React, { createContext, useContext, useCallback, useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { AxiosResponse, AxiosRequestConfig } from "axios";
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
            throw error;
        }
    }, []);

    const getProfile = async (): Promise<User | null> => {
        try {
            const response = await api.get('/user/profile');
            return response.data as User;
        } catch (error) {
            throw error;
        }
    };

    useEffect(() => {
        if (!loading && !user && isAuth === false) {
            if (!alertShowRef.current) {
                alert('เซสชันหมดอายุ กรุณาล็อกอินใหม่อีกครั้ง');
                router.push('/login');
                alertShowRef.current = true;
            }
        } else {
            alertShowRef.current = false;
        }
    }, [loading, user, router, isAuth]);

    const logout = useCallback(async (redirectImmediately: boolean = true) => {
        setLoading(true);
        try {
            await api.post('/auth/logout');
        } catch {
            console.error('Logout failed');
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

    const login = useCallback(async (email: string, password: string): Promise<User> => {
        setLoading(true);
        try {
            const response = await api.post('/auth/login', { email, password });
            const { accessToken: newAccessToken, user: userData } = response.data;

            if (!newAccessToken || !userData) {
                throw new Error('Login response missing access token or user data.');
            }

            setAccessToken(newAccessToken);
            setAccessTokenValue(newAccessToken)
            localStorage.setItem('accessToken', newAccessToken);

            setIsAuth(true);
            setUser(userData as User);

            const existingToken = getCsrfToken();
            if (!existingToken) {
                const csrfToken = await fetchCsrfToken();
                setCsrfToken(csrfToken);
            }

            const profileUser = await getProfile();
            if (profileUser) {
                setUser(profileUser);
                alertShowRef.current = false;
                const routePath = profileUser.role === UserRole.cooker ? (`cooker/${profileUser.restaurant?.restaurantId}`) : 'user/restaurant';
                router.push(`/${routePath}`);
                return profileUser;
            } else {
                await logout();
                throw new Error('Login successful, but user profile could not be loaded.');
            }
        } catch (err: unknown) {
            throw err;
        } finally {
            setLoading(false);
        }
    }, [router, getProfile, logout]);

    useEffect(() => {
        const requestInterceptor = api.interceptors.request.use(
            (config) => {
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
        const responseInterceptor = api.interceptors.response.use(
            (response) => response,
            async (error) => {
                const originalRequest = error.config;
                if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
                    originalRequest._retry = true;

                    if (!isRefreshing.current) {
                        isRefreshing.current = true;
                        try {
                            const refreshResponse = await api.post('/auth/refresh');
                            const newAccessToken = refreshResponse.data.accessToken;

                            setAccessToken(newAccessToken);
                            setAccessTokenValue(newAccessToken);

                            isRefreshing.current = false;
                            processQueue(null, newAccessToken);

                            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                            return api(originalRequest);
                        } catch (refreshError: unknown) {
                            isRefreshing.current = false;

                            const error =
                                refreshError instanceof Error
                                    ? refreshError
                                    : new Error(typeof refreshError === 'string' ? refreshError : JSON.stringify(refreshError));

                            processQueue(error);
                            await logout();
                            return Promise.reject(error);
                        }
                    } else {
                        return new Promise((resolve, reject) => {
                            failedQueue.current.push({ resolve, reject, config: originalRequest });
                        });
                    }
                }
                return Promise.reject(error instanceof Error ? error : new Error(JSON.stringify(error)))
            }
        );

        return () => {
            api.interceptors.request.eject(requestInterceptor);
            api.interceptors.response.eject(responseInterceptor);
        };
    }, [accessTokenValue, processQueue, logout]);

    useEffect(() => {
        const initializeAuthAndProfile = async () => {
            setLoading(true);
            try {
                const accessToken = localStorage.getItem('accessToken');
                if (!accessToken) throw new Error('Access token missing');
                setAccessTokenValue(accessToken);

                const profileUser = await getProfile();
                if (!profileUser && isAuth) throw new Error("Failed to fetch profile");

                setUser(profileUser);
                setIsAuth(true);
                alertShowRef.current = false;
            } catch (err: unknown) {
                if (
                    typeof err === 'object' &&
                    err !== null &&
                    'response' in err &&
                    err.response !== null &&
                    typeof err.response === 'object' &&
                    'status' in err.response
                ) {
                    const status = (err.response as { status?: number }).status;
                    if (status === 401) {
                        alert('รหัสผ่านหรืออีเมลไม่ถูกต้อง');
                        return;
                    }

                    if (status === 404) {
                        alert('ไม่พบบัญชีผู้ใช้นี้');
                        return;
                    }

                    if (status === 403) {
                        await logout(false);
                        if (!alertShowRef.current) {
                            alert('เซสชันหมดอายุ กรุณาล็อกอินใหม่อีกครั้ง');
                            router.push('/login');
                            alertShowRef.current = true;
                        }
                    }

                    alert('เกิดข้อผิดพลาด กรุณาลองใหม่');
                    return;
                }
            } finally {
                setLoading(false);
            }
        };
        initializeAuthAndProfile();
    }, []);

    const contextValue = React.useMemo(() => ({
        user,
        accessTokenValue,
        isAuth,
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