import { api } from "@/lib/api";
import type { MembershipStatus, Order, OperatingHour, RestaurantRole } from "@/lib/schema";
import { fromDayRows, type DayRow } from "@/lib/schema/format";

/* ───────── today's orders (endpoint already exists) ───────── */

export const getTodayOrders = async (restaurantId: string): Promise<Order[]> => {
    const res = await api.get<Order[]>(`/order/today/${restaurantId}`);
    return res.data;
};

export type SummaryRange = "today" | "week" | "month" | "3months" | "year" | "all";
/** Ranges that have a "previous period" to compare with (all time does not). */
export type TrendRange = Exclude<SummaryRange, "all">;

export const getOrderHistory = async (restaurantId: string, range: SummaryRange): Promise<Order[]> =>
    (await api.get<{ orders: Order[] }>(`/order/history/${restaurantId}`, { params: { range } })).data.orders;

export interface SalesTrend {
    unit: "hours" | "days" | "weeks" | "months";
    /** true = real mode: `open` marks buckets inside school ∩ canteen ∩ shop hours; false = debug mode (everything counts as open). */
    restricted: boolean;
    currentTotal: number;
    previousTotal: number;
    revenuePct: number | null;
    currentOrders: number;
    previousOrders: number;
    ordersPct: number | null;
    previousFrom: string;
    previousTo: string;
    buckets: { start: string; open: boolean; current: number; previous: number; currentOrders: number; previousOrders: number }[];
}

export const getSalesTrend = async (restaurantId: string, range: TrendRange) =>
    (await api.get<SalesTrend>(`/order/trend/${restaurantId}`, { params: { range } })).data;

export const markOrderDone = async (orderId: string) => {
    await api.patch(`/order/done/${orderId}`);
};

/* ───────── "today summary" computed from real orders ───────── */

export interface DaySummary {
    revenue: number;
    total: number;
    done: number;
    cancelled: number;
    delayed: number;
    hourly: { label: string; count: number }[];
    peakLabel: string | null;
}

const SLOT_MINUTES = 30;

export function summarizeOrders(orders: Order[]): DaySummary {
    const paid = orders.filter((o) => o.paymentStatus === "PAID" && o.status !== "rejected");
    const slots = new Map<number, number>();
    orders.forEach((o) => {
        const d = new Date(o.pickupAt);
        const minute = d.getHours() * 60 + d.getMinutes();
        const slot = Math.floor(minute / SLOT_MINUTES) * SLOT_MINUTES;
        slots.set(slot, (slots.get(slot) ?? 0) + 1);
    });
    const sortedSlots = [...slots.entries()].sort((a, b) => a[0] - b[0]);
    const hh = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    const peak = sortedSlots.reduce<[number, number] | null>((best, s) => (!best || s[1] > best[1] ? s : best), null);

    return {
        revenue: paid.reduce((s, o) => s + o.totalAmount, 0),
        total: orders.length,
        done: orders.filter((o) => o.status === "done").length,
        cancelled: orders.filter((o) => o.status === "rejected" || o.paymentStatus === "CANCELLED").length,
        delayed: orders.filter((o) => o.isDelay).length,
        hourly: sortedSlots.map(([m, count]) => ({ label: hh(m), count })),
        peakLabel: peak ? `${hh(peak[0])}–${hh(peak[0] + SLOT_MINUTES)}` : null,
    };
}

/* ───────── best sellers ───────── */

export type TopMetric = "qty" | "revenue";
export interface TopMenu { menuId: string; name: string; qty: number; revenue: number }

/** Money was (or is being) returned to the student, so the sale does not count. */
const isRefunded = (o: Order) => o.paymentStatus === "REFUNDED" || (o.refundRequests?.length ?? 0) > 0;

/**
 * Best sellers: paid, not rejected, not refunded orders; grouped by menu id (renames/duplicate names can't merge or split rows);
 * ranked by portions or by revenue (unitPrice × quantity). Shows the most recent name of each menu. Ties: more portions, then name.
 * `orders` must be newest-first (as the history endpoint returns them) for "most recent name" to hold.
 */
export function topMenus(orders: Order[], metric: TopMetric, limit: number): TopMenu[] {
    const byMenu = new Map<string, TopMenu>();
    for (const o of orders) {
        if (o.paymentStatus !== "PAID" || o.status === "rejected" || isRefunded(o)) continue;
        for (const m of o.orderMenus) {
            const row = byMenu.get(m.menuId) ?? { menuId: m.menuId, name: m.menuName, qty: 0, revenue: 0 };
            row.qty += m.quantity;
            row.revenue += m.unitPrice * m.quantity;
            byMenu.set(m.menuId, row);
        }
    }
    return [...byMenu.values()]
        .sort((a, b) => b[metric] - a[metric] || b.qty - a.qty || a.name.localeCompare(b.name, "th"))
        .slice(0, limit);
}

/* ───────── restaurant hours (schema: RestaurantOperatingHour) ───────── */

export const getRestaurantHours = async (restaurantId: string) => (await api.get<OperatingHour[]>(`/restaurant/${restaurantId}/hours`)).data;

export const saveRestaurantHours = async (restaurantId: string, rows: DayRow[]) => {
    await api.put(`/restaurant/${restaurantId}/hours`, { hours: fromDayRows(rows) });
};

/** The canteen/school window the restaurant must stay inside (shown as a note on the hours screen). */
export const getHoursWindow = async (restaurantId: string) => (await api.get<{ label: string }>(`/restaurant/${restaurantId}/hours-window`)).data;

/* ───────── staff (schema: RestaurantMembership) ───────── */

export interface StaffRow { id: string; userId?: string; name: string | null; email: string | null; role: RestaurantRole; status: MembershipStatus; pending: boolean; isMe: boolean }

/** Owner view: approved members plus cooks waiting for approval (`status` filters server-side when given). */
export const listStaff = async (restaurantId: string, status?: MembershipStatus) =>
    (await api.get<StaffRow[]>(`/restaurant/${restaurantId}/members`, { params: { status } })).data
        .filter((m) => m.status !== "REJECTED")
        .map((m) => ({ ...m, pending: m.status === "PENDING", isMe: false })); // `isMe` is resolved in the page from the signed-in user id

export const approveStaff = async (restaurantId: string, id: string) => {
    await api.patch(`/restaurant/${restaurantId}/members/${id}/approve`);
};

export const rejectStaff = async (restaurantId: string, id: string) => {
    await api.patch(`/restaurant/${restaurantId}/members/${id}/reject`);
};

export const removeStaff = async (restaurantId: string, id: string) => {
    await api.delete(`/restaurant/${restaurantId}/members/${id}`);
};

/* ───────── registration status ───────── */

export type RegistrationStatus = "PENDING" | "INACTIVE" | "ACTIVE" | "SUSPENDED" | "REMOVED";

export const getRegistrationStatus = async (restaurantId: string): Promise<{ status: RegistrationStatus }> => {
    const res = await api.get<{ status: RegistrationStatus }>(`/restaurant/${restaurantId}`);
    return { status: res.data.status };
};
