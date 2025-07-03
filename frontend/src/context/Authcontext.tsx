"use client";

import React, { createContext, useContext, useCallback, useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { profile } from "console";

interface User {
    userId: string;
    email: string;
    name?: string;
    restaurant?: {
        restaurantId: string;
    };
    profileImg?: string;
    role: 'user' | 'admin' | 'cooker';
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<User>;
    logout: () => Promise<void>;
}


const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const fetchCsrfToken = useCallback(async () => {
        try {
            console.log('Frontend: Attempting to fetch new CSRF token...');
            await api.get('/csrf-token');
        } catch (error) {
            console.error('Frontend: Failed to fetch CSRF token:', error);
        }
    }, []);

    useEffect(() => {
        getProfile();
    }, [fetchCsrfToken]);

    const getProfile = async (): Promise<User | null> => {
        await fetchCsrfToken();

        // Then, proceed with checking authentication status
        try {
            console.log('Frontend: Checking authentication status...');
            const response = await api.get('/user/profile');
            console.log('Frontend: Authentication status checked. User:', response.data);
            return response.data as User;
        } catch (error) {
            console.error('Frontend: Authentication check failed:', error);
            return null;
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!loading && !user) {
            alert('เซสชันหมดอายุ กรุณาล็อกอินใหม่อีกครั้ง');
            router.push('/login');
        }
    }, [loading, user, router]);

    const login = async (email: string, password: string): Promise<User> => {
        try {
            const response = await api.post('/auth/login', { email, password });
            setUser(response.data);
            console.log('Login successful');
            const user = await getProfile();

            if (user) {
                setUser(user);
                return user;
            } else {
                console.error('Login successful, but failed to fetch user profile.');
                await logout(); // Consider logging out if profile couldn't be fetched
                throw new Error('Login successful, but user profile could not be loaded.');
            }
        } catch (error) {
            console.error('Login failed: ', error);
            throw new Error('Invalid credentials');
        }
    }

    const logout = async () => {
        try {
            await api.post('/auth/logout');
            setUser(null);
            router.push('/loain');
        } catch (error) {
            console.error('Logout failed: ', error);
        }
    }

    const checkAuthStatus = async () => {
        try {
            const response = await api.get('/user/profile');
            setUser(response.data);
        } catch (error) {
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkAuthStatus();
    }, []);

    const value = { user, loading, login, logout };
    return (
        <AuthContext.Provider
            value={value}
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