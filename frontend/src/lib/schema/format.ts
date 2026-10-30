import type { RefundRequestStatus, DayOfWeek, OrderStatus, PaymentStatus, RestaurantCategory, RestaurantRole, SchoolRole, Status, OperatingHour } from "./index";

/* ───────────── time of day ───────────── */

export const minutesToHHmm = (m: number | null | undefined): string => {
    if (m == null) return "";
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};

export const hhmmToMinutes = (v: string): number => {
    const [h, m] = v.split(":").map((n) => Number.parseInt(n, 10));
    return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
};

export const formatRange = (open: number | null | undefined, close: number | null | undefined) =>
    open == null || close == null ? "ปิด" : `${minutesToHHmm(open)}–${minutesToHHmm(close)}`;

/* ───────────── money (Int baht) ───────────── */

export const formatBaht = (n: number) => n.toLocaleString("th-TH");

/* ───────────── days ───────────── */

export const DAYS: { key: DayOfWeek; short: string; long: string; letter: string }[] = [
    { key: "MONDAY", short: "จ.", long: "จันทร์", letter: "จ" },
    { key: "TUESDAY", short: "อ.", long: "อังคาร", letter: "อ" },
    { key: "WEDNESDAY", short: "พ.", long: "พุธ", letter: "พ" },
    { key: "THURSDAY", short: "พฤ.", long: "พฤหัสบดี", letter: "พฤ" },
    { key: "FRIDAY", short: "ศ.", long: "ศุกร์", letter: "ศ" },
    { key: "SATURDAY", short: "ส.", long: "เสาร์", letter: "ส" },
    { key: "SUNDAY", short: "อา.", long: "อาทิตย์", letter: "อา" },
];

export const WEEKDAYS: DayOfWeek[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];

export const dayLabel = (d: DayOfWeek, kind: "short" | "long" = "long") => DAYS.find((x) => x.key === d)?.[kind] ?? d;

export interface DayRow {
    day: DayOfWeek;
    open: boolean;
    from: string; // HH:mm
    to: string;
}

/** Build a 7-row editable week from the sparse `OperatingHour[]` the API returns. */
export function toDayRows(hours: OperatingHour[], fallback: { from: string; to: string } = { from: "10:30", to: "14:00" }): DayRow[] {
    return DAYS.map(({ key }) => {
        const h = hours.find((x) => x.dayOfWeek === key);
        return h
            ? { day: key, open: true, from: minutesToHHmm(h.openMinute), to: minutesToHHmm(h.closeMinute) }
            : { day: key, open: false, from: fallback.from, to: fallback.to };
    });
}

/** Inverse of `toDayRows` – closed days are simply omitted (unique [x, dayOfWeek] rows in the schema). */
export function fromDayRows(rows: DayRow[]): OperatingHour[] {
    return rows.filter((r) => r.open).map((r) => ({ dayOfWeek: r.day, openMinute: hhmmToMinutes(r.from), closeMinute: hhmmToMinutes(r.to) }));
}

/** "จ.–ศ. 10:30–14:00" style summary – groups consecutive days with equal hours. */
export function summarizeHours(hours: OperatingHour[]): string {
    if (!hours.length) return "ปิดทุกวัน";
    const ordered = DAYS.map((d) => hours.find((h) => h.dayOfWeek === d.key)).map((h, i) => ({ h, d: DAYS[i] }));
    const groups: { from: number; to: number; range: string }[] = [];
    ordered.forEach(({ h }, i) => {
        if (!h) return;
        const range = formatRange(h.openMinute, h.closeMinute);
        const last = groups[groups.length - 1];
        if (last && last.to === i - 1 && last.range === range) last.to = i;
        else groups.push({ from: i, to: i, range });
    });
    return groups
        .map((g) => `${g.from === g.to ? DAYS[g.from].short : `${DAYS[g.from].short}–${DAYS[g.to].short}`} ${g.range}`)
        .join(" · ");
}

/* ───────────── labels + chip tones ───────────── */

export type Tone = "primary" | "orange" | "success" | "danger" | "neutral";

export const TONE_CLASS: Record<Tone, string> = {
    primary: "bg-primary-light text-primary-dark",
    orange: "bg-brand-orange-light text-brand-orange-text",
    success: "bg-success-light text-success-main",
    danger: "bg-danger-light text-danger-text",
    neutral: "bg-neutral-light text-neutral-text",
};

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: Tone }> = {
    receive: { label: "ใหม่", tone: "orange" },
    cooking: { label: "กำลังทำ", tone: "primary" },
    ready: { label: "พร้อมรับ", tone: "success" },
    done: { label: "รับแล้ว", tone: "success" },
    delay: { label: "ล่าช้า", tone: "neutral" },
    rejected: { label: "ร้านปฏิเสธ", tone: "danger" },
};

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: Tone }> = {
    PENDING_VERIFICATION: { label: "รอตรวจสลิป", tone: "orange" },
    UNPAID: { label: "ยังไม่จ่าย", tone: "orange" },
    PAID: { label: "จ่ายแล้ว", tone: "success" },
    FAILED: { label: "สลิปไม่ผ่าน", tone: "danger" },
    CANCELLED: { label: "ยกเลิก", tone: "danger" },
    REFUNDED: { label: "คืนเงินแล้ว", tone: "neutral" },
};

export const ENTITY_STATUS: Record<Status, { label: string; tone: Tone }> = {
    PENDING: { label: "รออนุมัติ", tone: "orange" },
    ACTIVE: { label: "ใช้งาน", tone: "success" },
    INACTIVE: { label: "ไม่ใช้งาน", tone: "neutral" },
    SUSPENDED: { label: "ระงับ", tone: "danger" },
    REMOVED: { label: "ลบแล้ว", tone: "neutral" },
};

export const RESTAURANT_ROLE_LABEL: Record<RestaurantRole, string> = { OWNER: "เจ้าของร้าน", ADMIN: "ผู้ช่วยจัดการ", STAFF: "พนักงาน" };
export const SCHOOL_ROLE_LABEL: Record<SchoolRole, string> = { ADMIN: "ผู้ดูแล" };

export const CATEGORY_LABEL: Record<RestaurantCategory, string> = {
    Steak: "สเต็ก",
    Halal: "ฮาลาล",
    Made_to_order: "ตามสั่ง",
    Esan: "อาหารอีสาน",
    Rice: "เมนูข้าว",
    Appetizer: "อาหารทานเล่น",
    Noodle: "ก๋วยเตี๋ยว",
};

export const THAI_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

/** yyyy-mm-dd → { d: "23", m: "ต.ค." } (no timezone shift: the schema column is @db.Date) */
export function splitDate(date: string): { d: string; m: string } {
    const [, mm, dd] = date.split("-");
    return { d: String(Number.parseInt(dd, 10)), m: THAI_MONTHS_SHORT[Number.parseInt(mm, 10) - 1] ?? "" };
}

/** Short order code shown to students/cooks – first 4 hex chars of the uuid, upper-cased (same as the legacy screens). */
export const orderCode = (orderId: string) => orderId.replace(/-/g, "").slice(0, 4).toUpperCase();

const JS_DAY_TO_KEY: DayOfWeek[] = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

/** Today's opening range (Asia/Bangkok) from sparse `OperatingHour[]`, or null when closed today. */
export function todayHours(hours: OperatingHour[] | undefined, now: Date = new Date()): { open: string; close: string } | null {
    if (!hours?.length) return null;
    const weekday = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" })).getDay();
    const h = hours.find((x) => x.dayOfWeek === JS_DAY_TO_KEY[weekday]);
    return h ? { open: minutesToHHmm(h.openMinute), close: minutesToHHmm(h.closeMinute) } : null;
}


/* ───────── refund requests ───────── */

export const REFUND_STATUS: Record<RefundRequestStatus, { label: string; short: string; tone: Tone; icon: "clock" | "check" | "x" | "refund" }> = {
    PENDING: { label: "รอร้านตัดสินใจ", short: "รอร้านตัดสินใจ", tone: "orange", icon: "clock" },
    APPROVED: { label: "อนุมัติแล้ว · รอโอนคืน", short: "รอโอนคืน", tone: "primary", icon: "check" },
    REJECTED: { label: "ไม่อนุมัติ", short: "ไม่อนุมัติ", tone: "danger", icon: "x" },
    REFUNDED: { label: "โอนคืนแล้ว", short: "โอนคืนแล้ว", tone: "success", icon: "refund" },
};

/** Reasons a student can pick (API enum `RefundReason`). Unknown codes are shown as-is. */
export const REFUND_REASONS: { value: string; label: string }[] = [
    { value: "SHOP_CANCELLED", label: "ร้านยกเลิก / ไม่รับออเดอร์" },
    { value: "LATE_OR_NOT_READY", label: "อาหารไม่เสร็จตามเวลา" },
    { value: "MISSING_ITEM", label: "ได้อาหารไม่ครบ" },
    { value: "WRONG_ORDER", label: "ได้อาหารไม่ตรงกับที่สั่ง" },
    { value: "QUALITY", label: "คุณภาพอาหารมีปัญหา" },
    { value: "DUPLICATE_PAYMENT", label: "จ่ายเงินซ้ำ" },
    { value: "OTHER", label: "อื่น ๆ" },
];
export const refundReasonLabel = (code: string) => REFUND_REASONS.find((r) => r.value === code)?.label ?? code;

/** "ค้าง 3 ชม." style age for a request created at `iso`. */
export function waitLabel(iso: string, now: number = Date.now()): string {
    const mins = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
    if (mins < 1) return "เมื่อสักครู่";
    if (mins < 60) return `${mins} นาที`;
    if (mins < 60 * 24) return `${Math.floor(mins / 60)} ชม.`;
    return `${Math.floor(mins / 1440)} วัน`;
}

export const formatDateTime = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Bangkok" }) : "-";
