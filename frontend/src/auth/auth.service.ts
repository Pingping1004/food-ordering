import axios from "axios";
import { api } from "@/lib/api";
import { getSupabase } from "@/lib/supabase/client";
import type { User } from "./auth.types";

const origin = () => (typeof window === "undefined" ? "" : window.location.origin);

/** Supabase Auth errors → Thai copy. Messages from Supabase are English and not user-facing. */
export function authErrorMessage(err: unknown, fallback = "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"): string {
    const message = String((err as { message?: string })?.message ?? "");
    const code = (err as { code?: string })?.code;

    if (code === "invalid_credentials" || /invalid login credentials/i.test(message)) return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
    if (code === "email_not_confirmed" || /email not confirmed/i.test(message)) return "กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ (ดูลิงก์ในกล่องจดหมาย)";
    if (code === "user_already_exists" || /already registered/i.test(message)) return "อีเมลนี้มีผู้ใช้งานแล้ว กรุณาใช้อีเมลอื่น";
    if (code === "weak_password" || /password should be/i.test(message)) return "รหัสผ่านสั้นหรือคาดเดาง่ายเกินไป (อย่างน้อย 6 ตัวอักษร)";
    if (code === "over_request_rate_limit" || code === "over_email_send_rate_limit" || /rate limit/i.test(message)) return "ลองบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่";
    if (/network|fetch/i.test(message)) return "เครือข่ายขัดข้อง กรุณาลองใหม่อีกครั้ง";
    return /[\u0E00-\u0E7F]/.test(message) ? message : fallback;
}

export async function signInApi(email: string, password: string) {
    const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.session;
}

/**
 * Onboarding hints saved in Supabase `user_metadata`; /onboarding consumes and clears them.
 * The invite code alone decides the role – there is no "I am a" choice any more. Schools are created by the
 * system admin, who hands the first school admin a code, so nothing else rides along.
 */
export interface SignupMeta { invite_code?: string }

/** `needsConfirmation` = the project requires e-mail confirmation, so there is no session yet. */
export async function signUpApi(email: string, password: string, name?: string, next = "/onboarding", extra: SignupMeta = {}) {
    const { data, error } = await getSupabase().auth.signUp({
        email,
        password,
        options: {
            // the invite code rides along in user_metadata so they survive the e-mail-confirm redirect
            data: { name: name?.trim() || email.split("@")[0], ...extra },
            emailRedirectTo: `${origin()}/auth/callback?next=${encodeURIComponent(next)}`,
        },
    });
    if (error) throw error;
    // With confirmation on, an existing address returns a fake user with no identities instead of an error.
    if (data.user && data.user.identities?.length === 0) throw { code: "user_already_exists", message: "User already registered" };
    return { needsConfirmation: !data.session };
}

/** This device only. Supabase's default scope ("global") would also end the account's sessions on every other device. */
export async function signOutApi() {
    await getSupabase().auth.signOut({ scope: "local" });
}

export async function sendPasswordResetApi(email: string) {
    const { error } = await getSupabase().auth.resetPasswordForEmail(email, { redirectTo: `${origin()}/auth/callback?next=/reset-password` });
    if (error) throw error;
}

export async function updatePasswordApi(password: string) {
    const { error } = await getSupabase().auth.updateUser({ password });
    if (error) throw error;
}

/** App profile (role, memberships) – lives in our DB, keyed by the Supabase user id. */
export async function getProfileApi(): Promise<User> {
    try {
        const res = await api.get<User>("/user/profile");
        return res.data;
    } catch (err) {
        if (axios.isAxiosError(err)) {
            const status = err.response?.status;
            if (status === 401) throw new Error("เซสชันหมดอายุ");
            if (status === 403) throw new Error("การเข้าถึงถูกปฏิเสธ");
            if (status === 404) throw new Error("ไม่พบผู้ใช้งาน");
            if (err.code === "ECONNABORTED") throw new Error("เครือข่ายขัดข้อง");
        }
        throw err;
    }
}

export async function readOnboardingMeta(): Promise<SignupMeta> {
    const { data } = await getSupabase().auth.getUser();
    const m = (data.user?.user_metadata ?? {}) as SignupMeta;
    return { invite_code: m.invite_code || undefined };
}

export async function clearOnboardingMeta() {
    // `intent` / `school_name` no longer exist; nulling them also wipes values left by older sign-ups
    await getSupabase().auth.updateUser({ data: { invite_code: null, school_name: null, intent: null } });
}
