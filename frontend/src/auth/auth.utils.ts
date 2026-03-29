import { AxiosError } from "axios";
import { UserRole } from "./auth.types";

export function getFormattedBackendMessage(message: string | string[] | undefined): string | undefined {
    if (!message) return undefined;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.join(', ');

    return undefined;
};

export function getRoleFromAccessToken(token: string | null): UserRole | undefined {
    if (!token) return undefined;
    try {
        const parts = token.split('.');
        if (parts.length < 2) return undefined;
        const payloadJson = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
        const payload = JSON.parse(payloadJson) as { role?: string };
        const role = payload.role as UserRole | undefined;
        return role;
    } catch {
        return undefined;
    }
};

export function parseLoginErrorMessage(err: unknown): string {
    if (typeof err === 'object' && err !== null && 'response' in err) {
        const error = err as AxiosError<{ message: string }>;
        const status = error.response?.status;
        const backendMessage = getFormattedBackendMessage(error.response?.data.message);

        if (status === 401) {
            return backendMessage || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
        } else if (status === 403) {
            return 'เซสชันหมดอายุ กรุณาล็อกอินใหม่อีกครั้ง';
        } else if (status === 404) {
            return 'ไม่พบบริการหรือเส้นทางที่ร้องขอ';
        } else if (backendMessage) {
            return backendMessage;
        } else {
            return 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง';
        }
    } else if (err instanceof Error) {
        return err.message;
    } else {
        return 'เกิดข้อผิดพลาดที่ไม่รู้จัก กรุณาลองใหม่';
    }

}