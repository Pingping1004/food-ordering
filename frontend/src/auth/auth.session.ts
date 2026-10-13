import { getProfileApi } from "./auth.service"

export async function checkSessionValidity() {
    try {
        const res = await getProfileApi()
        return !!res
    } catch {
        return false
    }
}

export async function initSession() {
    try {
        const profile = await getProfileApi()
        return profile
    } catch {
        return null
    }
}