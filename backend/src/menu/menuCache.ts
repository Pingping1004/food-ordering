import { MenusWithDisplayPrices } from "./menu.service"

export type CacheEntry<T> = {
    data: T
    expireAt: number
}

const menuCache = new Map<string, CacheEntry<MenusWithDisplayPrices[]>>();
const menuQuotaCache = new Map<string, CacheEntry<Record<string, number>>>();

export function getMenuCache(key: string) {
    const entry = menuCache.get(key)
    if (!entry) return null

    if (Date.now() > entry.expireAt) {
        menuCache.delete(key)
        return null
    }

    return entry.data
}

export function setMenuCache(key: string, data: MenusWithDisplayPrices[], ttl: number) {
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
        return null
    }

    if (Date.now() > entry.expireAt) {
        menuQuotaCache.delete(key)
        return null
    }

    return entry.data
}

export function setMenuQuotaCache(key: string, data: Record<string, number>, ttl: number) {
    menuQuotaCache.set(key, {
        data,
        expireAt: Date.now() + ttl
    })
}

export function clearMenuQuotaCache(key: string) {
    menuQuotaCache.delete(key)
}