import { getProfileApi } from "./auth.service"

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

let refreshTimer: NodeJS.Timeout | null = null
export function scheduleRefresh(refreshFn: () => Promise<void>, onFail: () => void) {
    if (refreshTimer) clearTimeout(refreshTimer)

    refreshTimer = setTimeout(async () => {
        try {
            await refreshFn()
            scheduleRefresh(refreshFn, onFail)
        } catch {
            onFail()
        }
    }, 25 * 60 * 1000)
}

export function clearRefresh() {
    if (refreshTimer) clearTimeout(refreshTimer)
    refreshTimer = null
}