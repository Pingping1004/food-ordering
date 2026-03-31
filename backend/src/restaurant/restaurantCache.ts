import { DateWeek, RestaurantCategory } from "@prisma/client"
import { CacheEntry } from "src/menu/menuCache"

export interface RestaurantCache {
    restaurantId: string,
    restaurantImg: string | null,
    name: string,
    location: string | null,
    categories: RestaurantCategory[],
    openDate: DateWeek[],
    openTime: string,
    closeTime: string,
    avgCookingTime: number,
    isTemporarilyClosed: boolean,
    accountNumber: string,
    bankAccount: string,
    accountHolderFullName: string,
}

export type OpenRestaurant = RestaurantCache & {
    isScheduledOpenDay: boolean
    isScheduledOpenTime: boolean
    isOpen: boolean
    isActuallyOpen: boolean
  }

const restaurantCache = new Map < string, CacheEntry<unknown>>();

export function getRestaurantCache<T>(key: string): T | null {
    const entry = restaurantCache.get(key)
    if (!entry) {
        return null
    }

    if (Date.now() > entry.expireAt) {
        restaurantCache.delete(key)
        return null
    }

    return entry.data as T
}

export function setRestaurantCache<T>(key: string, data: T, ttl: number) {
    restaurantCache.set(key, {
        data,
        expireAt: Date.now() + ttl
    })
}

export function clearRestaurantCache(key: string) {
    restaurantCache.delete(key)
}