import { getProfileApi } from "./auth.service"

export async function checkSessionValidity() {
    try {
        return !!(await getProfileApi())
    } catch {
        return false
    }
}

export async function initSession() {
    try {
        return await getProfileApi()
    } catch {
        return null
    }
}
