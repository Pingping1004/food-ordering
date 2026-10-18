import { RestaurantCategory } from '@prisma/client';
import { AccountType } from 'src/common/interface/accountType';
import { CacheEntry } from 'src/menu/menuCache';

export interface RestaurantCache {
  restaurantId: string;
  profile?: string | null;
  restaurantImg?: string | null;
  name: string;
  location: string | null;
  categories: RestaurantCategory[];
  openDate?: any;
  openTime?: any;
  closeTime?: any;
  avgCookingTime?: number;
  avgCookingTimeMins?: number | null;
  isTemporarilyClosed?: boolean;
  accountNumber: string;
  bankAccount?: AccountType | null;
  accountName?: string;
  accountHolderFullName?: string;
  paymentQr?: string;
  canteenId?: string;
  maxActiveOrders?: number;
  maxActiveOrder?: number;
  isAutoAcceptedOrder?: boolean;
  operatingHours?: any[];
  contactName?: string;
  contactSurname?: string | null;
  contactTel?: string;
  contactEmail?: string;
  bankType?: string | null;
  status?: string;
}

export type OpenRestaurant = RestaurantCache & {
  isScheduledOpenDay: boolean;
  isScheduledOpenTime: boolean;
  isOpen: boolean;
  isActuallyOpen: boolean;
};

const restaurantCache = new Map<string, CacheEntry<unknown>>();

export function getRestaurantCache<T>(key: string): T | null {
  const entry = restaurantCache.get(key);
  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expireAt) {
    restaurantCache.delete(key);
    return null;
  }

  return entry.data as T;
}

export function setRestaurantCache<T>(key: string, data: T, ttl: number) {
  restaurantCache.set(key, {
    data,
    expireAt: Date.now() + ttl,
  });
}

export function clearRestaurantCache(key: string) {
  restaurantCache.delete(key);
}

/** Drop every entry whose key starts with `prefix` (e.g. all per-school restaurant lists). */
export function clearRestaurantCacheByPrefix(prefix: string) {
  for (const key of restaurantCache.keys()) {
    if (key.startsWith(prefix)) restaurantCache.delete(key);
  }
}
