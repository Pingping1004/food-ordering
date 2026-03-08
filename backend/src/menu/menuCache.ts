import { MenusWithDisplayPrices } from "./menu.service"

export type CacheEntry<T> = {
    data: T
    expireAt: number
}

const menuCache = new Map<string, CacheEntry<MenusWithDisplayPrices[]>>();
const menuQuotaCache = new Map<string, CacheEntry<Record<string, number>>>();

export function getMenuCache(key: string) {
    const entry = menuCache.get(key)
    if (!entry) {
        console.log("❌ CACHE MISS:", key)
        return null
    }

    if (Date.now() > entry.expireAt) {
        console.log("⌛ CACHE EXPIRED:", key)
        menuCache.delete(key)
        return null
    }

    console.log("✅ CACHE HIT:", key)
    return entry.data
}

export function setMenuCache(key: string, data: MenusWithDisplayPrices[], ttl: number) {
    console.log("Cache set: ", key)
    menuCache.set(key, {
        data,
        expireAt: Date.now() + ttl
    })
}

export function clearMenuCache(key: string) {
    menuCache.delete(key)
}

export function getMenuQuotaCache(key: string): Record<string, number> | null {
    const entry = menuQuotaCache.get(key)
    if (!entry) {
        console.log("❌ QUOTA CACHE MISS:", key)
        return null
    }

    if (Date.now() > entry.expireAt) {
        console.log("⌛ QUOTA CACHE EXPIRED:", key)
        menuQuotaCache.delete(key)
        return null
    }

    console.log("✅ QUOTA CACHE HIT:", key)
    return entry.data
}

export function setMenuQuotaCache(key: string, data: Record<string, number>, ttl: number) {
    console.log("Quota cache set: ", key)
    menuQuotaCache.set(key, {
        data,
        expireAt: Date.now() + ttl
    })
}

export function clearMenuQuotaCache(key: string) {
    menuQuotaCache.delete(key)
}