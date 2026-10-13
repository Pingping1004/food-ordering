"use client";

import { User } from "@/auth/auth.types";
import { createContext } from "react";

export interface AuthContextType {
    user: User | null;
    isAuth: boolean;
    loading: boolean;
    initializing: boolean;
    login: (email: string, password: string) => Promise<User>;
    logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);