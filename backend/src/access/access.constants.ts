import type { RestaurantRole } from '@prisma/client';

export const SCHOOL_SCOPE_KEY = 'access:schoolScope';
export const RESTAURANT_SCOPE_KEY = 'access:restaurantScope';

export interface RestaurantScopeOptions {
  /** Route param holding the id. `restaurantId`, `menuId` and `orderId` are resolved to their restaurant. */
  param: string;
  /** Allowed membership roles (explicit – OWNER does not imply STAFF). */
  roles: RestaurantRole[];
  /** Also let an approved admin of the restaurant's school through (reads / status changes). */
  allowSchoolAdmin?: boolean;
}

export const SYSADMIN_WRITE_KEY = 'access:sysadminWrite';

/** How long a break-glass support grant stays valid. */
export const SUPPORT_GRANT_TTL_MINUTES = 30;

export const SYSADMIN_READ_ONLY_CODE = 'SYSADMIN_READ_ONLY';
export const SYSADMIN_READ_ONLY_MESSAGE =
  'ผู้ดูแลระบบอ่านได้อย่างเดียว ต้องเปิดสิทธิ์ช่วยเหลือ (support grant) ก่อนแก้ไขข้อมูลโรงเรียน';

export const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
