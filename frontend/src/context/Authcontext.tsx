"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";

interface User {
    userId: string;
    email: string;
    name?: string;
    profileImg?: string;
    role: 'user' | 'admin' | 'cooker';
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const login = async (email: string, password: string) => {
        try {
            const response = await api.post('/auth/login', { email, password });
            setUser(response.data.user);
            console.log('Login successful');
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