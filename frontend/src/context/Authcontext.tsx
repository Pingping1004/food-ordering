"use client";

import React, { createContext, useContext, useCallback, useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { AxiosHeaders } from "axios";
import { useRouter } from "next/navigation";
import { getAccessToken, getCsrfToken, setAccessToken, removeAccessToken, removeCsrfToken, setCsrfToken } from "@/lib/token";

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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAuth, setIsAuth] = useState(false);
    const [accessTokenValue, setAccessTokenValue] = useState<string | null>(null);
    const router = useRouter();

    const isRefreshing = useRef(false);
    const alertShowRef = useRef(false);
    const failedQueue = useRef<Array<{ resolve: (value?: any) => void; reject: (reason?: any) => void; config: any }>>([]);

    const processQueue = useCallback((error: Error | null, token: string | null = null) => {
        failedQueue.current.forEach(prom => {
            if (error) {
                prom.reject(error);
            } else if (token) {
                if (!prom.config.headers) {
                    prom.config.headers = new AxiosHeaders();
                } else if (!(prom.config.headers instanceof AxiosHeaders)) {
                    prom.config.headers = AxiosHeaders.from(prom.config.headers);
                }
                prom.config.headers['Authorization'] = `Bearer ${token}`;
                prom.resolve(api(prom.config));
            }
        });
        failedQueue.current = [];
    }, []);

    const fetchCsrfToken = useCallback(async () => {
        try {
            const result = await api.get('/csrf-token');
            const csrfTokenValue = result.data.csrfToken;
            setCsrfToken(csrfTokenValue);
            return csrfTokenValue;
        } catch (error) {
            console.error('Frontend: Failed to fetch CSRF token:', error);
            throw error;
        }
    }, []);

    const getProfile = async (): Promise<User | null> => {
        try {
            const response = await api.get('/user/profile');
            return response.data as User;
        } catch (error) {
            console.error('Frontend: Authentication check failed:', error);
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
        } catch (error) {
            console.error('Logout failed: ', error);
        } finally {
            setUser(null);
            setAccessTokenValue(null);
            removeCsrfToken();
            removeAccessToken();
            setIsAuth(false);
            setLoading(false);
            alertShowRef.current = false;

            if (redirectImmediately) {
                router.push('/login');
            }
        }
    }, [router]);

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

            const csrfToken = getCsrfToken();
            if (!csrfToken) throw new Error('Fail to get csrf token');
            setCsrfToken(csrfToken);
            
            const profileUser = await getProfile();
            if (profileUser) {
                setUser(profileUser);
                alertShowRef.current = false;
                const routePath = profileUser.role === UserRole.cooker ? (`cooker/${profileUser.restaurant?.restaurantId}`) : 'user/restaurant';
                router.push(`/${routePath}`);
                return profileUser;
            } else {
                console.error('Login successful, but failed to fetch user profile.');
                await logout();
                throw new Error('Login successful, but user profile could not be loaded.');
            }
        } catch (error) {
            console.error('Login failed: ', error);
            throw new Error('Invalid credentials');
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
            (error: any) => {
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
                        } catch (refreshError: any) {
                            isRefreshing.current = false;
                            processQueue(refreshError);
                            await logout();
                            return Promise.reject(refreshError instanceof Error ? refreshError : new Error(JSON.stringify(refreshError)));
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
                if (!getCsrfToken()) await fetchCsrfToken();

                const profileUser = await getProfile();
                if (!profileUser) throw new Error("Failed to fetch profile");

                setUser(profileUser);
                setIsAuth(true);
                alertShowRef.current = false;
            } catch (err: any) {
                if (err.response?.status === 401 || err.response?.status === 403) {
                    await logout(false);
                    if (!alertShowRef.current) {
                        alert('เซสชันหมดอายุ กรุณาล็อกอินใหม่อีกครั้ง');
                        router.push('/login');
                        alertShowRef.current = true;
                    }
                }
            } finally {
                setLoading(false);
            }
        };

        // const handleLogoutSideEffects = () => {
        //     setUser(null);
        //     setIsAuth(false);
        //     setAccessTokenValue(null);
        //     removeAccessToken();
        //     removeCsrfToken();
        // };
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