/**
 * Plain-language (Thai) reason why a request failed, for error toasts.
 * Written for non-technical and older users: short, no jargon, says what to do next.
 * Kept free of UI imports so both `api.ts` and `Toast.tsx` can use it.
 */
type ErrLike = {
    code?: string;
    message?: string;
    response?: { status?: number; data?: { message?: string | string[] } };
};

const hasThai = (s: string) => /[฀-๿]/.test(s);

/** The API's own message, only when it is already written in Thai (English/technical ones are not user-facing). */
export function thaiApiMessage(err: unknown): string | undefined {
    const m = (err as ErrLike | undefined)?.response?.data?.message;
    const text = Array.isArray(m) ? m.join(", ") : m;
    return text && hasThai(text) ? text : undefined;
}

export function errorReason(err: unknown): string | undefined {
    if (!err) return undefined;
    const e = err as ErrLike;
    const status = e.response?.status;

    if (!status) {
        if (e.code === "ECONNABORTED" || e.code === "ETIMEDOUT" || /timeout/i.test(e.message ?? ""))
            return "ระบบตอบกลับช้าเกินไป กรุณารอสักครู่แล้วลองอีกครั้ง";
        if (e.code === "ERR_NETWORK" || /network|failed to fetch/i.test(e.message ?? ""))
            return "อินเทอร์เน็ตอาจหลุด กรุณาตรวจสอบสัญญาณแล้วลองอีกครั้ง";
        return undefined;
    }

    const own = thaiApiMessage(err);
    if (own) return own;

    if (status === 400 || status === 422) return "ข้อมูลที่กรอกยังไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง";
    if (status === 401) return "หมดเวลาเข้าใช้งาน กรุณาเข้าสู่ระบบใหม่อีกครั้ง";
    if (status === 403) return "บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้";
    if (status === 404) return "ไม่พบข้อมูลนี้ อาจถูกลบหรือเปลี่ยนแปลงไปแล้ว";
    if (status === 409) return "ข้อมูลนี้มีอยู่แล้ว หรือเพิ่งถูกเปลี่ยนโดยผู้อื่น";
    if (status === 413) return "ไฟล์ใหญ่เกินไป กรุณาเลือกไฟล์ที่เล็กลง";
    if (status === 429) return "ทำรายการบ่อยเกินไป กรุณารอสักครู่แล้วลองอีกครั้ง";
    if (status >= 500) return "ระบบขัดข้องชั่วคราว ไม่ใช่ความผิดของคุณ กรุณาลองใหม่ภายหลัง";
    return undefined;
}
