import { getProfileApi } from "./auth.service"
import { getAccessTokenExpiresAtMs } from "./auth.utils"

const DEFAULT_ACCESS_TTL_MS = 30 * 60 * 1000
const REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1000
const MIN_SCHEDULE_MS = 30 * 1000

function getMsUntilProactiveRefresh(): number {
    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null
    if (!token) return DEFAULT_ACCESS_TTL_MS - REFRESH_BEFORE_EXPIRY_MS

    const expMs = getAccessTokenExpiresAtMs(token)
    if (expMs == null) return DEFAULT_ACCESS_TTL_MS - REFRESH_BEFORE_EXPIRY_MS

    if (expMs <= Date.now()) return 0

    const ttlMs = expMs - Date.now()
    const untilRefresh = ttlMs - REFRESH_BEFORE_EXPIRY_MS
    return Math.max(MIN_SCHEDULE_MS, untilRefresh)
}

export async function checkSessionValidity() {
    const token = localStorage.getItem("accessToken")
    if (!token) return false

    try {
        const res = await getProfileApi()
        return !!res
    } catch {
        return false
    }
}

export async function initSession() {
    const token = localStorage.getItem("accessToken")
    if (!token) return null
    
    try {
        const profile = await getProfileApi()
        return profile
    } catch {
        localStorage.removeItem("accessToken")
        return null
    }
}

let refreshTimer: ReturnType<typeof setTimeout> | null = null

export function scheduleRefresh(refreshFn: () => Promise<void>, onFail: () => void) {
    if (refreshTimer) clearTimeout(refreshTimer)

    const delay = getMsUntilProactiveRefresh()
    refreshTimer = setTimeout(async () => {
        try {
            await refreshFn()
            scheduleRefresh(refreshFn, onFail)
        } catch {
            onFail()
        }
    }, delay)
}

export async function refreshAccessTokenIfStale(
    refreshFn: () => Promise<void>,
    marginMs: number = 2 * 60 * 1000
): Promise<boolean> {
    if (typeof window === "undefined") return false
    const token = localStorage.getItem("accessToken")
    if (!token) return false

    const expMs = getAccessTokenExpiresAtMs(token)
    const now = Date.now()
    const needsRefresh = expMs == null || expMs <= now + marginMs
    if (!needsRefresh) return false

    await refreshFn()
    return true
}

let visibilityHandler: (() => void) | null = null

export function attachTabVisibleTokenCatchUp(
    refreshFn: () => Promise<void>,
    onFail: () => void
) {
    detachTabVisibleTokenCatchUp()

    visibilityHandler = () => {
        if (document.visibilityState !== "visible") return
        void (async () => {
            try {
                await refreshAccessTokenIfStale(refreshFn)
            } catch {
                onFail()
            }
        })()
    }

    document.addEventListener("visibilitychange", visibilityHandler)
}

export function detachTabVisibleTokenCatchUp() {
    if (visibilityHandler) {
        document.removeEventListener("visibilitychange", visibilityHandler)
        visibilityHandler = null
    }
}

export function clearRefresh() {
    if (refreshTimer) clearTimeout(refreshTimer)
    refreshTimer = null
}