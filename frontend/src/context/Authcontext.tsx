"use client";

import { User } from "@/auth/auth.types";
import type { SignupMeta } from "@/auth/auth.service";
import { createContext } from "react";

export interface AuthContextType {
    user: User | null;
    isAuth: boolean;
    loading: boolean;
    initializing: boolean;
    login: (email: string, password: string) => Promise<User>;
    /** `needsConfirmation: true` → Supabase sent a confirmation mail and there is no session yet. */
    signup: (email: string, password: string, name?: string, next?: string, extra?: SignupMeta) => Promise<{ needsConfirmation: boolean }>;
    logout: () => Promise<void>;
    /** Re-read the profile (after role / membership changes). */
    refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
