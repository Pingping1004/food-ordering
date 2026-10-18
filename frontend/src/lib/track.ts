import { api } from "@/lib/api";

export type EventSource = "student_web" | "restaurant_cms" | "admin_panel";
/** Subset of schema.prisma `EventName` the web clients emit. */
export type ClientEventName = "feedback_submitted" | "client_error" | "restaurant_viewed" | "menu_viewed" | "checkout_started";

/**
 * Best-effort analytics (POST /events, plan §5). Never blocks or throws: losing one event must not break a student's order.
 */
export async function trackEvent(name: ClientEventName, opts: { source?: EventSource; restaurantId?: string; schoolId?: string; metadata?: Record<string, unknown> } = {}) {
    try {
        await api.post("/events", { name, source: opts.source ?? "student_web", restaurantId: opts.restaurantId, schoolId: opts.schoolId, metadata: opts.metadata });
    } catch {
        /* intentionally ignored */
    }
}
