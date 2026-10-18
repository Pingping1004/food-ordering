import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  SAFE_METHODS,
  SYSADMIN_READ_ONLY_CODE,
  SYSADMIN_READ_ONLY_MESSAGE,
} from './access.constants';
import {
  MembershipStatus,
  Role,
  RestaurantRole,
  SchoolRole,
  Status,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestUser } from '../supabase/supabase.service';

export interface AccessContext {
  /** DB role is ADMIN **and** the token is aal2 (TOTP verified). */
  isSystemAdmin: boolean;
  schoolId: string | null;
  /** Schools where the user is an APPROVED school admin. */
  schoolAdminOf: string[];
  /** APPROVED restaurant memberships. */
  restaurantRoles: Map<string, RestaurantRole>;
}

export interface RestaurantRef {
  restaurantId?: string;
  menuId?: string;
  orderId?: string;
}

type AccessUser = Pick<RequestUser, 'userId'> &
  Partial<Pick<RequestUser, 'aal' | 'role'>>;

@Injectable()
export class AccessService {
  /** Per-request cache: keyed by the request object so it dies with the request. */
  private readonly cache = new WeakMap<object, Promise<AccessContext>>();

  constructor(private readonly prisma: PrismaService) {}

  /** `cacheKey` is normally the Express request; omit it to bypass caching. */
  getContext(user: AccessUser, cacheKey?: object): Promise<AccessContext> {
    if (cacheKey) {
      const hit = this.cache.get(cacheKey);
      if (hit) return hit;
      const p = this.load(user);
      this.cache.set(cacheKey, p);
      p.catch(() => this.cache.delete(cacheKey));
      return p;
    }
    return this.load(user);
  }

  private async load(user: AccessUser): Promise<AccessContext> {
    const row = await this.prisma.user.findUnique({
      where: { userId: user.userId },
      select: {
        role: true,
        schoolId: true,
        schoolMemberships: {
          where: { status: MembershipStatus.APPROVED, role: SchoolRole.ADMIN },
          select: { schoolId: true },
        },
        restaurantMemberships: {
          where: { status: MembershipStatus.APPROVED },
          select: { restaurantId: true, role: true },
        },
      },
    });

    if (!row) {
      return {
        isSystemAdmin: false,
        schoolId: null,
        schoolAdminOf: [],
        restaurantRoles: new Map(),
      };
    }

    return {
      isSystemAdmin: row.role === Role.ADMIN && user.aal === 'aal2',
      schoolId: row.schoolId,
      schoolAdminOf: row.schoolMemberships.map((m) => m.schoolId),
      restaurantRoles: new Map(
        row.restaurantMemberships.map((m) => [m.restaurantId, m.role]),
      ),
    };
  }

  async assertSystemAdmin(user: AccessUser, cacheKey?: object): Promise<void> {
    const ctx = await this.getContext(user, cacheKey);
    if (!ctx.isSystemAdmin)
      throw new ForbiddenException(
        'ต้องเป็นผู้ดูแลระบบที่ยืนยันตัวตนสองขั้นตอนแล้ว',
      );
  }

  /**
   * Least privilege for the system admin: reads pass, writes inside a school need `@SysadminWrite()`
   * (`req.sysadminWrite`) or an ACTIVE support grant. `req` is the Express request (its method decides;
   * no request = treated as a read). On success a write is flagged on `req.sysadminAudit` so the audit
   * interceptor logs it. A `null` school (platform-level route) is never restricted.
   */
  async enforceSysadminPolicy(
    user: AccessUser,
    schoolId: string | null | undefined,
    req?: any,
  ): Promise<void> {
    const method = String(req?.method ?? 'GET').toUpperCase();
    if (SAFE_METHODS.has(method) || !schoolId) return;

    if (req.sysadminWrite) {
      req.sysadminAudit = { schoolId, grantId: null };
      return;
    }
    const grant = await this.prisma.supportGrant.findFirst({
      where: {
        adminId: user.userId,
        schoolId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { expiresAt: 'desc' },
      select: { id: true },
    });
    if (!grant)
      throw new ForbiddenException({
        message: SYSADMIN_READ_ONLY_MESSAGE,
        code: SYSADMIN_READ_ONLY_CODE,
      });
    req.sysadminAudit = { schoolId, grantId: grant.id };
  }

  /** Marks a school admin's non-GET request on `req.schoolAdminAudit` so the audit interceptor logs it. */
  private flagSchoolAdminWrite(schoolId: string, req?: any): void {
    const method = String(req?.method ?? 'GET').toUpperCase();
    if (!req || SAFE_METHODS.has(method)) return;
    req.schoolAdminAudit = { schoolId };
  }

  /** System admin (read; writes per `enforceSysadminPolicy`), or an approved admin of exactly this school. */
  async assertSchoolAdmin(
    user: AccessUser,
    schoolId: string,
    cacheKey?: object,
  ): Promise<AccessContext> {
    const ctx = await this.getContext(user, cacheKey);
    if (schoolId && ctx.schoolAdminOf.includes(schoolId)) {
      this.flagSchoolAdminWrite(schoolId, cacheKey);
      return ctx;
    }
    if (ctx.isSystemAdmin) {
      await this.enforceSysadminPolicy(user, schoolId, cacheKey);
      return ctx;
    }
    throw new ForbiddenException('คุณไม่มีสิทธิ์จัดการโรงเรียนนี้');
  }

  /**
   * System admin always passes. Otherwise the user needs an approved membership whose role is in `roles`.
   * With `allowSchoolAdmin`, an approved admin of the restaurant's school passes as well (read / status use).
   */
  async assertRestaurantRole(
    user: AccessUser,
    restaurantId: string,
    roles: RestaurantRole[],
    opts: { allowSchoolAdmin?: boolean; cacheKey?: object } = {},
  ): Promise<AccessContext> {
    const ctx = await this.getContext(user, opts.cacheKey);

    const role = ctx.restaurantRoles.get(restaurantId);
    if (role && roles.includes(role)) return ctx;

    if (ctx.isSystemAdmin) {
      const method = String((opts.cacheKey as any)?.method ?? 'GET');
      if (!SAFE_METHODS.has(method.toUpperCase())) {
        const r = await this.prisma.restaurant.findUnique({
          where: { restaurantId },
          select: { canteen: { select: { schoolId: true } } },
        });
        await this.enforceSysadminPolicy(
          user,
          r?.canteen.schoolId ?? null,
          opts.cacheKey,
        );
      }
      return ctx;
    }

    if (opts.allowSchoolAdmin && ctx.schoolAdminOf.length > 0) {
      const restaurant = await this.prisma.restaurant.findUnique({
        where: { restaurantId },
        select: { canteen: { select: { schoolId: true } } },
      });
      if (restaurant && ctx.schoolAdminOf.includes(restaurant.canteen.schoolId)) {
        this.flagSchoolAdminWrite(restaurant.canteen.schoolId, opts.cacheKey);
        return ctx;
      }
    }
    throw new ForbiddenException('คุณไม่มีสิทธิ์จัดการร้านอาหารนี้');
  }

  /** Resolve the owning restaurant from one of restaurantId / menuId / orderId. 404 when missing. */
  async resolveRestaurantId(ref: RestaurantRef): Promise<string> {
    if (ref.restaurantId) {
      const r = await this.prisma.restaurant.findUnique({
        where: { restaurantId: ref.restaurantId },
        select: { restaurantId: true },
      });
      if (r) return r.restaurantId;
    } else if (ref.menuId) {
      const m = await this.prisma.menu.findUnique({
        where: { menuId: ref.menuId },
        select: { restaurantId: true },
      });
      if (m) return m.restaurantId;
    } else if (ref.orderId) {
      const o = await this.prisma.order.findUnique({
        where: { orderId: ref.orderId },
        select: { restaurantId: true },
      });
      if (o) return o.restaurantId;
    }
    throw new NotFoundException('ไม่พบข้อมูล');
  }

  /**
   * Read access to a restaurant (menu, order creation, details). Anything outside the caller's school is a 404.
   * Inside the school: students see ACTIVE/SUSPENDED shops; PENDING/REMOVED only to members, school admins, sysadmin.
   */
  async assertRestaurantVisible(
    user: AccessUser,
    restaurantId: string,
    cacheKey?: object,
  ): Promise<{ status: Status; schoolId: string; schoolStatus?: Status }> {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { restaurantId },
      select: {
        status: true,
        canteen: { select: { schoolId: true, school: { select: { status: true } } } },
      },
    });
    if (!restaurant) throw new NotFoundException('ไม่พบข้อมูล');

    const ctx = await this.getContext(user, cacheKey);
    const schoolId = restaurant.canteen.schoolId;
    const result = {
      status: restaurant.status,
      schoolId,
      schoolStatus: restaurant.canteen.school?.status,
    };

    if (ctx.isSystemAdmin) return result;
    if (
      ctx.restaurantRoles.has(restaurantId) ||
      ctx.schoolAdminOf.includes(schoolId)
    )
      return result;
    if (
      ctx.schoolId === schoolId &&
      (restaurant.status === Status.ACTIVE ||
        restaurant.status === Status.SUSPENDED)
    ) {
      return result;
    }
    throw new NotFoundException('ไม่พบข้อมูล');
  }

  /** Uploading images: sysadmin, school admin, an owner/admin of a shop, or any member of a school. */
  async assertCanUpload(user: AccessUser, cacheKey?: object): Promise<void> {
    const ctx = await this.getContext(user, cacheKey);
    if (ctx.isSystemAdmin || ctx.schoolId || ctx.schoolAdminOf.length > 0)
      return;
    for (const role of ctx.restaurantRoles.values()) {
      if (role === RestaurantRole.OWNER || role === RestaurantRole.ADMIN)
        return;
    }
    throw new ForbiddenException('ต้องเข้าร่วมโรงเรียนก่อน');
  }

  /** Like assertRestaurantRole, but a restaurant the caller cannot see (other school) is a 404 instead of a 403. */
  async assertRestaurantRoleScoped(
    user: AccessUser,
    restaurantId: string,
    roles: RestaurantRole[],
    opts: { allowSchoolAdmin?: boolean; cacheKey?: object } = {},
  ): Promise<AccessContext> {
    await this.resolveRestaurantId({ restaurantId });
    try {
      return await this.assertRestaurantRole(user, restaurantId, roles, opts);
    } catch (err) {
      if (err instanceof ForbiddenException)
        await this.hideInvisibleRestaurant(user, restaurantId, opts.cacheKey);
      throw err;
    }
  }

  /**
   * Call after a 403: throws 404 when the restaurant is not visible to the caller (other school), so ids cannot
   * be probed. Users without any school (e.g. an admin without MFA) keep the plain 403.
   */
  async hideInvisibleRestaurant(
    user: AccessUser,
    restaurantId: string,
    cacheKey?: object,
  ): Promise<void> {
    const ctx = await this.getContext(user, cacheKey);
    if (!ctx.schoolId && ctx.schoolAdminOf.length === 0) return;
    await this.assertRestaurantVisible(user, restaurantId, cacheKey);
  }

  /** Menu image staging: sysadmin or an owner/admin of at least one shop. */
  async assertCanManageMenus(
    user: AccessUser,
    cacheKey?: object,
  ): Promise<void> {
    const ctx = await this.getContext(user, cacheKey);
    if (ctx.isSystemAdmin) return;
    for (const role of ctx.restaurantRoles.values()) {
      if (
        role === RestaurantRole.OWNER ||
        role === RestaurantRole.ADMIN ||
        role === RestaurantRole.STAFF
      )
        return;
    }
    throw new ForbiddenException('คุณไม่มีสิทธิ์จัดการเมนู');
  }
}
