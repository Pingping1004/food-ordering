import { api } from "@/lib/api";
import type { CursorPage, Order, RefundDecisionAction, RefundRequest, RefundRequestStatus, RefundSummary } from "@/lib/schema";

const PAGE = 30;

/* ───────── student ───────── */

export interface CreateRefundInput { reason: string; details?: string }

/** 201 `RefundRequestDto`. Errors carry `code`: ORDER_NOT_PAID, REFUND_WINDOW_EXPIRED, REFUND_ALREADY_REQUESTED. */
export const createRefundRequest = async (orderId: string, input: CreateRefundInput) =>
    (await api.post<RefundRequest>(`/order/${orderId}/refund-request`, { reason: input.reason, details: input.details?.trim() || undefined })).data;

export const listMyRefundRequests = async () => (await api.get<{ items: RefundRequest[] }>(`/me/refund-requests`)).data.items;

export const getMyRefundRequest = async (id: string) => (await api.get<RefundRequest>(`/me/refund-requests/${id}`)).data;

/** The order behind a refund form (the same route the tracking screens use). */
export const getOrderForRefund = async (orderId: string) => (await api.get<Order & { restaurant?: { name?: string } }>(`/order/${orderId}`)).data;

/* ───────── shop (decides) ───────── */

export const listRestaurantRefundRequests = async (restaurantId: string, params: { status?: RefundRequestStatus; cursor?: string } = {}) =>
    (await api.get<CursorPage<RefundRequest>>(`/restaurant/${restaurantId}/refund-requests`, { params: { ...params, limit: PAGE } })).data;

/** OWNER / ADMIN only. PENDING → approve | reject (note required), APPROVED → mark_refunded. */
export const decideRefund = async (restaurantId: string, id: string, action: RefundDecisionAction, note?: string) =>
    (await api.patch<RefundRequest>(`/restaurant/${restaurantId}/refund-requests/${id}`, { action, note: note?.trim() || undefined })).data;

/* ───────── school admin (read-only) ───────── */

export const listSchoolRefunds = async (schoolId: string, params: { status?: RefundRequestStatus; cursor?: string; limit?: number } = {}) =>
    (await api.get<CursorPage<RefundRequest>>(`/schools/${schoolId}/refund-requests`, { params: { limit: PAGE, ...params } })).data;

export const getSchoolRefundSummary = async (schoolId: string) =>
    (await api.get<RefundSummary>(`/schools/${schoolId}/refund-requests/summary`)).data;

export const getSchoolRefund = async (schoolId: string, id: string) =>
    (await api.get<RefundRequest>(`/schools/${schoolId}/refund-requests/${id}`)).data;
