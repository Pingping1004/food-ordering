import { Status } from '@prisma/client';
import { TtlCache } from '../common/ttl-cache';

export type RestaurantVisibility = { status: Status; schoolId: string; schoolStatus?: Status };

/**
 * restaurantId → (shop status, school, school status). Read on every menu, queue-count and order request
 * (3 queries each), changes only when a school admin or sysadmin acts. Writers call
 * `invalidateRestaurantVisibility`; the short TTL bounds staleness if one is missed. Order creation bypasses it.
 */
export const restaurantVisibilityCache = new TtlCache<RestaurantVisibility | null>(5_000, 2_000);

/** Pass a restaurantId to drop one shop, nothing to drop all (school status changes affect every shop in it). */
export function invalidateRestaurantVisibility(restaurantId?: string) {
  restaurantVisibilityCache.invalidate(restaurantId ?? '');
}
