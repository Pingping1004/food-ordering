import axios, { AxiosError, AxiosHeaders } from "axios";
import { getSupabase } from "@/lib/supabase/client";
import { toastDanger } from "@/components/ui/Toast";

const rawBackendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL;
const defaultBackendUrl =
    typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
        ? "https://localhost:4000"
        : "https://api.promptserve.online";

const backendOrigin = (rawBackendUrl && rawBackendUrl !== "undefined" ? rawBackendUrl : defaultBackendUrl).replace(/\/+$/, "");
const baseBackendUrl = backendOrigin.endsWith("/api") ? backendOrigin : `${backendOrigin}/api`;

/**
 * API client. Auth = the Supabase access token as a Bearer header (no cookies, so no CSRF handling and no
 * hand-rolled refresh: supabase-js renews the token before `getSession()` returns it).
 */
export const api = axios.create({
    baseURL: baseBackendUrl,
    withCredentials: false,
    timeout: 1000 * 30,
});

export function normalizeError(err: unknown): Error {
    if (err instanceof Error) return err;
    if (typeof err === "string") return new Error(err);
    return new Error(JSON.stringify(err));
}

api.interceptors.request.use(
    async (config) => {
        // Legacy opt-out header some callers still send for public endpoints – never forward it.
        if (config.headers instanceof AxiosHeaders) {
            config.headers.delete("skipAuth");
            config.headers.delete("skipauth");
        }

        if (typeof window === "undefined") return config;

        const { data } = await getSupabase().auth.getSession();
        const token = data.session?.access_token;
        if (token) {
            if (!(config.headers instanceof AxiosHeaders)) config.headers = AxiosHeaders.from(config.headers);
            config.headers.set("Authorization", `Bearer ${token}`);
        }
        return config;
    },
    (error) => Promise.reject(normalizeError(error)),
);

/** 403 `SYSADMIN_READ_ONLY`: a system admin tried to change school data without an active support grant. */
export const SYSADMIN_READ_ONLY_EVENT = "sysadmin-read-only";

export function isSysadminReadOnlyError(err: unknown): boolean {
    const res = (err as AxiosError<{ code?: string; error?: string; message?: string | string[] }> | undefined)?.response;
    if (res?.status !== 403) return false;
    const d = res.data;
    const msg = Array.isArray(d?.message) ? d.message.join(" ") : d?.message;
    return d?.code === "SYSADMIN_READ_ONLY" || d?.error === "SYSADMIN_READ_ONLY" || msg === "SYSADMIN_READ_ONLY";
}

/** The API's own message (Nest `message`, string or list) or a fallback. */
export function apiMessage(err: unknown, fallback: string): string {
    const m = (err as AxiosError<{ message?: string | string[] }> | undefined)?.response?.data?.message;
    return (Array.isArray(m) ? m.join(", ") : m) || fallback;
}

/**
 * Tell the school shell a write was refused: it toasts and offers break-glass. Pages that have no school shell
 * (e.g. /admin) do not handle the event, so a plain toast is shown instead.
 */
export function notifySysadminReadOnly() {
    if (typeof window === "undefined") return;
    const event = new CustomEvent<{ handled: boolean }>(SYSADMIN_READ_ONLY_EVENT, { detail: { handled: false } });
    window.dispatchEvent(event);
    if (!event.detail.handled) toastDanger("แก้ไขข้อมูลโรงเรียนไม่ได้ตอนนี้", "บัญชีผู้ดูแลระบบดูข้อมูลได้อย่างเดียว หากต้องแก้ไข ให้เปิดโหมดช่วยเหลือที่หน้าโรงเรียนก่อน");
}

const PUBLIC_PATHS = ["/", "/login", "/signup", "/forgot-password", "/reset-password"];
let signingOut = false;

api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const hadToken = !!error.config?.headers && AxiosHeaders.from(error.config.headers as AxiosHeaders).has("Authorization");

        // The API rejected a token Supabase still holds (revoked / user deleted) → end the session once.
        if (error.response?.status === 401 && hadToken && !signingOut && typeof window !== "undefined") {
            signingOut = true;
            try {
                await getSupabase().auth.signOut();
            } finally {
                signingOut = false;
                if (!PUBLIC_PATHS.includes(window.location.pathname)) window.location.href = "/login";
            }
        }
        return Promise.reject(normalizeError(error));
    },
);
