import {
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  MembershipStatus,
  OrderStatus,
  Prisma,
  RestaurantRole,
  Role,
  SchoolRole,
  Status,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  clearRestaurantCache,
  clearRestaurantCacheByPrefix,
} from '../restaurant/restaurantCache';
import { CreateCanteenDto, UpdateCanteenDto } from './dto/school.dto';
import { UploadService } from '../upload/upload.service';
import { TtlCache } from '../common/ttl-cache';

/** Allowed restaurant status moves a school admin can make. */
const STATUS_TRANSITIONS: Record<Status, Status[]> = {
  [Status.PENDING]: [Status.ACTIVE, Status.REMOVED],
  [Status.ACTIVE]: [Status.SUSPENDED, Status.REMOVED],
  [Status.SUSPENDED]: [Status.ACTIVE, Status.REMOVED],
  [Status.INACTIVE]: [],
  [Status.REMOVED]: [],
};

export const SUMMARY_RANGES = ['this_week', 'last_week', 'this_month', 'last_month', 'this_semester'] as const;
export type SummaryRange = (typeof SUMMARY_RANGES)[number];

const BKK_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Bangkok-time [from, to) of the chosen range plus the period right before it (for the deltas). Weeks start on Monday.
 * Semester 1 = May–Sep, semester 2 = Nov–Feb; in a break month (Oct, Mar, Apr) the semester that just ended is used.
 */
function resolveSummaryPeriod(range: SummaryRange, now = new Date()) {
  const b = new Date(now.getTime() + BKK_OFFSET_MS);
  const y = b.getUTCFullYear();
  const m = b.getUTCMonth();
  const d = b.getUTCDate();
  const at = (yy: number, mm: number, dd: number) => new Date(Date.UTC(yy, mm, dd) - BKK_OFFSET_MS);
  const isWeek = range === 'this_week' || range === 'last_week';
  const isSemester = range === 'this_semester';
  let from: Date, to: Date, prevFrom: Date, prevTo: Date;
  let semester = 1;
  if (isSemester) {
    semester = m >= 4 && m <= 9 ? 1 : 2;
    const startYear = semester === 1 || m >= 10 ? y : y - 1;
    from = semester === 1 ? at(startYear, 4, 1) : at(startYear, 10, 1);
    to = semester === 1 ? at(startYear, 9, 1) : at(startYear + 1, 2, 1);
    prevFrom = semester === 1 ? at(startYear - 1, 10, 1) : at(startYear, 4, 1);
    prevTo = semester === 1 ? at(startYear, 2, 1) : at(startYear, 9, 1);
  } else if (isWeek) {
    const monday = d - ((b.getUTCDay() + 6) % 7) + (range === 'last_week' ? -7 : 0);
    from = at(y, m, monday);
    to = at(y, m, monday + 7);
    prevFrom = at(y, m, monday - 7);
    prevTo = from;
  } else {
    const mo = m + (range === 'last_month' ? -1 : 0);
    from = at(y, mo, 1);
    to = at(y, mo + 1, 1);
    prevFrom = at(y, mo - 1, 1);
    prevTo = from;
  }
  const fmt = (dt: Date, opts: Intl.DateTimeFormatOptions) => dt.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', ...opts });
  const last = new Date(to.getTime() - DAY_MS);
  const label = isSemester
    ? `ภาคเรียนที่ ${semester} · ${fmt(from, { month: 'short' })} – ${fmt(last, { month: 'short', year: 'numeric' })}`
    : isWeek
      ? `${fmt(from, { day: 'numeric', month: 'short' })} – ${fmt(last, { day: 'numeric', month: 'short' })}`
      : fmt(from, { month: 'long', year: 'numeric' });
  const startOfYear = at(new Date(from.getTime() + BKK_OFFSET_MS).getUTCFullYear(), 0, 1);
  return {
    from, to, prevFrom, prevTo, label,
    semester,
    weekNumber: Math.floor((from.getTime() - startOfYear.getTime()) / (7 * DAY_MS)) + 1,
    prevName: isSemester ? 'ภาคเรียนก่อนหน้า' : isWeek ? 'สัปดาห์ก่อนหน้า' : 'เดือนก่อนหน้า',
  };
}

/** "+12.5% จากสัปดาห์ก่อนหน้า". `lowerIsBetter` flips which direction is green (e.g. refunds). */
function pctDelta(cur: number, prev: number, prevName: string, lowerIsBetter = false) {
  const direction: 'up' | 'down' = cur >= prev ? 'up' : 'down';
  const good = cur === prev || (direction === 'up') !== lowerIsBetter;
  if (prev === 0) return { deltaLabel: cur === 0 ? `เท่ากับ${prevName}` : `ไม่มีข้อมูล${prevName}`, good: cur === 0 || !lowerIsBetter, direction };
  const pct = Math.round(((cur - prev) / prev) * 1000) / 10;
  return { deltaLabel: `${pct > 0 ? '+' : ''}${pct}% จาก${prevName}`, good, direction };
}

@Injectable()
export class SchoolAdminService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly uploadService?: UploadService,
  ) {}

  // ---------------------------------------------------------------- canteens

  async listCanteens(schoolId: string) {
    const canteens = await this.prisma.canteen.findMany({
      where: { schoolId },
      orderBy: { name: 'asc' },
      select: {
        canteenId: true,
        name: true,
        profile: true,
        status: true,
        _count: {
          select: {
            restaurants: { where: { status: { not: Status.REMOVED } } },
          },
        },
      },
    });
    return canteens.map(({ _count, ...c }) => ({
      ...c,
      restaurantCount: _count.restaurants,
    }));
  }

  async createCanteen(
    schoolId: string,
    dto: CreateCanteenDto,
    file?: Express.Multer.File,
  ) {
    let profile = dto.profile ?? null;
    if (file && this.uploadService) {
      const uploaded = await this.uploadService.saveImage(file);
      profile = uploaded.url;
    }

    try {
      const canteen = await this.prisma.canteen.create({
        data: {
          schoolId,
          name: dto.name.trim(),
          profile,
          status: dto.status ?? Status.ACTIVE,
        },
        select: {
          canteenId: true,
          name: true,
          profile: true,
          status: true,
          schoolId: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (dto.hours && Array.isArray(dto.hours) && dto.hours.length > 0) {
        await this.prisma.canteenOperatingHour.createMany({
          data: dto.hours.map((h: any) => ({
            canteenId: canteen.canteenId,
            dayOfWeek: h.dayOfWeek,
            openMinute: Number(h.openMinute),
            closeMinute: Number(h.closeMinute),
          })),
        });
      }

      return canteen;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('มีโรงอาหารชื่อนี้อยู่แล้ว');
      }
      throw error;
    }
  }

  private async findCanteenInSchool(schoolId: string, canteenId: string) {
    const canteen = await this.prisma.canteen.findFirst({
      where: { canteenId, schoolId },
      select: { canteenId: true },
    });
    if (!canteen) throw new NotFoundException('ไม่พบโรงอาหาร');
    return canteen;
  }

  async updateCanteen(
    schoolId: string,
    canteenId: string,
    dto: UpdateCanteenDto,
    file?: Express.Multer.File,
  ) {
    await this.findCanteenInSchool(schoolId, canteenId);
    const data: Prisma.CanteenUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.profile !== undefined) data.profile = dto.profile;
    if (dto.status !== undefined) data.status = dto.status;

    if (file && this.uploadService) {
      const uploaded = await this.uploadService.saveImage(file);
      data.profile = uploaded.url;
    }

    try {
      const updated = await this.prisma.canteen.update({
        where: { canteenId },
        data,
        select: {
          canteenId: true,
          name: true,
          profile: true,
          status: true,
          schoolId: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (dto.hours && Array.isArray(dto.hours)) {
        await this.prisma.$transaction(async (tx) => {
          await tx.canteenOperatingHour.deleteMany({ where: { canteenId } });
          if (dto.hours && dto.hours.length > 0) {
            await tx.canteenOperatingHour.createMany({
              data: dto.hours.map((h: any) => ({
                canteenId,
                dayOfWeek: h.dayOfWeek,
                openMinute: Number(h.openMinute),
                closeMinute: Number(h.closeMinute),
              })),
            });
          }
        });
      }

      return updated;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('มีโรงอาหารชื่อนี้อยู่แล้ว');
      }
      throw error;
    }
  }

  async deleteCanteen(schoolId: string, canteenId: string) {
    await this.findCanteenInSchool(schoolId, canteenId);
    const live = await this.prisma.restaurant.count({
      where: { canteenId, status: { not: Status.REMOVED } },
    });
    if (live > 0)
      throw new ConflictException('ไม่สามารถลบโรงอาหารที่ยังมีร้านค้าอยู่');

    await this.prisma.canteen.delete({ where: { canteenId } });
    this.invalidateRestaurantCaches();
    return { deleted: true };
  }

  // ---------------------------------------------------------------- restaurants

  async listRestaurants(schoolId: string, status?: Status) {
    const rows = await this.prisma.restaurant.findMany({
      where: { canteen: { schoolId }, ...(status ? { status } : {}) },
      orderBy: { name: 'asc' },
      select: {
        restaurantId: true,
        name: true,
        profile: true,
        status: true,
        canteenId: true,
        canteen: { select: { name: true } },
        contactName: true,
        contactSurname: true,
        bankType: true,
        contactTel: true,
        contactEmail: true,
        memberships: {
          where: { role: RestaurantRole.OWNER },
          take: 1,
          select: {
            user: { select: { userId: true, name: true, email: true } },
          },
        },
      },
    });

    return rows.map(({ canteen, memberships, ...r }) => ({
      ...r,
      canteenName: canteen.name,
      owner: memberships[0]?.user ?? null,
    }));
  }

  async getRestaurant(schoolId: string, restaurantId: string) {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { restaurantId, canteen: { schoolId } },
      include: {
        canteen: {
          select: {
            canteenId: true,
            name: true,
            operatingHours: true,
          },
        },
        operatingHours: true,
        memberships: {
          include: {
            user: { select: { userId: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!restaurant) throw new NotFoundException('ไม่พบร้านอาหาร');

    const ownerMembership =
      restaurant.memberships.find((m) => m.role === RestaurantRole.OWNER) ??
      restaurant.memberships[0];

    const joinedDate = ownerMembership?.createdAt ?? new Date();
    const joinedAt = joinedDate.toISOString().slice(0, 10);

    const people =
      restaurant.memberships.length > 0
        ? restaurant.memberships.map((m) => ({
            name: m.user?.name || m.user?.email || 'ไม่ระบุชื่อ',
            role: m.role,
          }))
        : [
            {
              name:
                [restaurant.contactName, restaurant.contactSurname]
                  .filter(Boolean)
                  .join(' ') || 'เจ้าของร้าน',
              role: RestaurantRole.OWNER,
            },
          ];

    const rawHours =
      restaurant.operatingHours && restaurant.operatingHours.length > 0
        ? restaurant.operatingHours
        : (restaurant.canteen?.operatingHours ?? []);

    const hours = rawHours.map((h) => ({
      dayOfWeek: h.dayOfWeek,
      openMinute: h.openMinute,
      closeMinute: h.closeMinute,
    }));

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const orders = await this.prisma.order.findMany({
      where: {
        restaurantId,
        orderAt: { gte: oneWeekAgo },
      },
      select: {
        orderId: true,
        status: true,
        isDelay: true,
      },
    });

    const totalOrders = orders.length;
    let delayRate = 0;
    let rejectRate = 0;
    const medianAcceptSeconds = 45;

    if (totalOrders > 0) {
      const delayed = orders.filter((o) => o.isDelay).length;
      delayRate = Math.round((delayed / totalOrders) * 1000) / 10;
      const rejected = orders.filter(
        (o) => o.status === OrderStatus.rejected,
      ).length;
      rejectRate = Math.round((rejected / totalOrders) * 1000) / 10;
    }

    const { memberships, canteen, operatingHours, ...rest } = restaurant;

    return {
      ...rest,
      canteenName: canteen.name,
      joinedAt,
      createdAt: joinedDate.toISOString(),
      pendingApproval: restaurant.status === Status.PENDING,
      hours,
      hoursLabel: hours.length > 0 ? '-' : 'ปิดทุกวัน',
      people,
      week: {
        orders: totalOrders,
        medianAcceptSeconds,
        delayRate,
        rejectRate,
      },
    };
  }

  async setRestaurantStatus(
    schoolId: string,
    restaurantId: string,
    next: Status,
  ) {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { restaurantId, canteen: { schoolId } },
      select: { status: true },
    });
    if (!restaurant) throw new NotFoundException('ไม่พบร้านอาหาร');
    if (!STATUS_TRANSITIONS[restaurant.status]?.includes(next)) {
      throw new ConflictException(
        `ไม่สามารถเปลี่ยนสถานะร้านจาก ${restaurant.status} เป็น ${next}`,
      );
    }

    // Compare-and-set so a concurrent change cannot be overwritten blindly.
    const { count } = await this.prisma.restaurant.updateMany({
      where: { restaurantId, status: restaurant.status },
      data: { status: next },
    });
    if (count === 0)
      throw new ConflictException('สถานะร้านถูกเปลี่ยนไปแล้ว กรุณารีเฟรช');

    this.invalidateRestaurantCaches(restaurantId);
    return { restaurantId, status: next };
  }

  /** Move a shop to another canteen of the same school (restaurant names are unique per canteen). */
  async moveRestaurantCanteen(
    schoolId: string,
    restaurantId: string,
    canteenId: string,
  ) {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { restaurantId, canteen: { schoolId } },
      select: { name: true, canteenId: true },
    });
    if (!restaurant) throw new NotFoundException('ไม่พบร้านอาหาร');
    await this.findCanteenInSchool(schoolId, canteenId);
    if (restaurant.canteenId === canteenId)
      throw new ConflictException('ร้านอยู่ในโรงอาหารนี้อยู่แล้ว');

    const clash = await this.prisma.restaurant.findFirst({
      where: { canteenId, name: restaurant.name },
      select: { restaurantId: true },
    });
    if (clash)
      throw new ConflictException('โรงอาหารปลายทางมีร้านชื่อเดียวกันอยู่แล้ว');

    await this.prisma.restaurant.update({
      where: { restaurantId },
      data: { canteenId },
    });

    this.invalidateRestaurantCaches(restaurantId);
    return { restaurantId, canteenId };
  }

  private invalidateRestaurantCaches(restaurantId?: string) {
    if (restaurantId) clearRestaurantCache(`restaurant:${restaurantId}`);
    clearRestaurantCacheByPrefix('restaurants:');
  }

  // ---------------------------------------------------------------- school members

  async listMembers(schoolId: string, status?: MembershipStatus) {
    const rows = await this.prisma.schoolMembership.findMany({
      where: { schoolId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        role: true,
        status: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
    });
    return rows.map(({ user, ...m }) => ({
      ...m,
      name: user.name,
      email: user.email,
    }));
  }

  private async findMemberInSchool(schoolId: string, memberId: string) {
    const member = await this.prisma.schoolMembership.findFirst({
      where: { id: memberId, schoolId },
    });
    if (!member) throw new NotFoundException('ไม่พบสมาชิก');
    return member;
  }

  async approveMember(schoolId: string, memberId: string) {
    const member = await this.findMemberInSchool(schoolId, memberId);
    if (member.status !== MembershipStatus.PENDING)
      throw new ConflictException('คำขอนี้ถูกดำเนินการไปแล้ว');

    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.schoolMembership.updateMany({
        where: { id: memberId, status: MembershipStatus.PENDING },
        data: { status: MembershipStatus.APPROVED },
      });
      if (count === 0) throw new ConflictException('คำขอนี้ถูกดำเนินการไปแล้ว');
      await tx.user.updateMany({
        where: { userId: member.userId, schoolId: null },
        data: { schoolId },
      });
      return {
        id: member.id,
        userId: member.userId,
        role: member.role,
        status: MembershipStatus.APPROVED,
      };
    });
  }

  async rejectMember(schoolId: string, memberId: string) {
    const member = await this.findMemberInSchool(schoolId, memberId);
    if (member.status !== MembershipStatus.PENDING)
      throw new ConflictException('คำขอนี้ถูกดำเนินการไปแล้ว');

    const { count } = await this.prisma.schoolMembership.updateMany({
      where: { id: memberId, status: MembershipStatus.PENDING },
      data: { status: MembershipStatus.REJECTED },
    });
    if (count === 0) throw new ConflictException('คำขอนี้ถูกดำเนินการไปแล้ว');
    return {
      id: member.id,
      userId: member.userId,
      role: member.role,
      status: MembershipStatus.REJECTED,
    };
  }

  /** Removes a membership. The last APPROVED admin of a school can never be removed. */
  async removeMember(schoolId: string, memberId: string) {
    const member = await this.findMemberInSchool(schoolId, memberId);

    if (
      member.role === SchoolRole.ADMIN &&
      member.status === MembershipStatus.APPROVED
    ) {
      const admins = await this.prisma.schoolMembership.count({
        where: {
          schoolId,
          role: SchoolRole.ADMIN,
          status: MembershipStatus.APPROVED,
        },
      });
      if (admins <= 1)
        throw new ConflictException('ไม่สามารถลบผู้ดูแลโรงเรียนคนสุดท้ายได้');
    }

    await this.prisma.schoolMembership.delete({ where: { id: memberId } });
    return { deleted: true };
  }

  // ---------------------------------------------------------------- metrics & summary

  /** Dashboard analytics tolerate a little staleness; the TTL also absorbs bursts of identical requests. */
  private readonly summaryCache = new TtlCache<Awaited<ReturnType<SchoolAdminService['computeSchoolSummary']>>>(30_000);

  getSchoolSummary(schoolId: string, range: SummaryRange = 'this_week') {
    return this.summaryCache.get(`${schoolId}:${range}`, () =>
      this.computeSchoolSummary(schoolId, range),
    );
  }

  private async computeSchoolSummary(schoolId: string, range: SummaryRange) {
    const period = resolveSummaryPeriod(range);
    const [school, restaurants] = await Promise.all([
      this.prisma.school.findUnique({
        where: { schoolId },
        select: { schoolId: true, name: true, studentAmount: true },
      }),
      this.prisma.restaurant.findMany({
        where: { canteen: { schoolId }, status: { not: Status.REMOVED } },
        select: { restaurantId: true, name: true, status: true },
      }),
    ]);
    if (!school) throw new NotFoundException('ไม่พบโรงเรียน');

    const restaurantIds = restaurants.map((r) => r.restaurantId);
    const nameOf = new Map(restaurants.map((r) => [r.restaurantId, r.name]));

    // Only the selected period and the one before it are ever read, so never load a school's whole order history.
    const windowFrom = new Date(Math.min(period.from.getTime(), period.prevFrom.getTime()));
    const windowTo = new Date(Math.max(period.to.getTime(), period.prevTo.getTime()));

    const [
      orders,
      commentRows,
      refundsCur,
      refundsPrev,
      eventRows,
    ] = await Promise.all([
      this.prisma.order.findMany({
        where: { restaurantId: { in: restaurantIds }, orderAt: { gte: windowFrom, lt: windowTo } },
        select: {
          orderId: true,
          restaurantId: true,
          status: true,
          totalAmount: true,
          orderAt: true,
          pickupAt: true,
          paidAt: true,
          acceptAt: true,
          isDelay: true,
          userId: true,
        },
      }),
      // Every written comment students ever left for this school's shops, newest first – deliberately NOT limited to
      // the selected period (nor hidden by the "sample" view below), so the school never misses a message.
      this.prisma.events.findMany({
        where: {
          name: 'feedback_submitted',
          OR: [{ schoolId }, { restaurantId: { in: restaurantIds } }],
        },
        orderBy: { createdAt: 'desc' },
        take: 1000,
        select: { metadata: true, createdAt: true, restaurantId: true },
      }),
      this.prisma.refundRequest.count({ where: { schoolId, createdAt: { gte: period.from, lt: period.to } } }),
      this.prisma.refundRequest.count({ where: { schoolId, createdAt: { gte: period.prevFrom, lt: period.prevTo } } }),
      this.prisma.events.findMany({
        where: {
          restaurantId: { in: restaurantIds },
          createdAt: { gte: period.from, lt: period.to },
          name: { in: ['order_auto_rejected', 'order_auto_cancelled', 'payment_verification_failed', 'duplicate_order_detected', 'feedback_submitted'] },
        },
        select: { name: true, metadata: true },
      }),
    ]);

    // "Active students" counts only accounts whose role is a student (Role.USER): cooks, shop owners and admins who
    // happen to order lunch are not students.
    const orderUserIds = [...new Set(orders.map((o) => o.userId).filter((id): id is string => !!id))];
    const studentIds = new Set(
      orderUserIds.length === 0
        ? []
        : (
            await this.prisma.user.findMany({
              where: { role: Role.USER, userId: { in: orderUserIds } },
              select: { userId: true },
            })
          ).map((u) => u.userId),
    );

    const allComments = commentRows.flatMap((e) => {
      const m = (e.metadata ?? {}) as { rating?: number; comment?: string };
      const text = typeof m.comment === 'string' ? m.comment.trim() : '';
      return text && typeof m.rating === 'number' && m.rating >= 1 && m.rating <= 5
        ? [{ rating: m.rating, text, createdAt: e.createdAt, restaurantName: e.restaurantId ? nameOf.get(e.restaurantId) ?? null : null }]
        : [];
    });

    const inRange = (o: { orderAt: Date }, from: Date, to: Date) => o.orderAt >= from && o.orderAt < to;
    const cur = orders.filter((o) => inRange(o, period.from, period.to));
    const prev = orders.filter((o) => inRange(o, period.prevFrom, period.prevTo));
    const eventCount = (...names: string[]) => eventRows.filter((e) => names.includes(e.name)).length;
    const pctOf = (n: number, total: number) => (total > 0 ? `${Math.round((n / total) * 1000) / 10}%` : '0%');
    const reliabilityRow = (label: string, definition: string, count: number, total: number, asPercent = true) => ({
      label, definition, count, total, display: asPercent ? pctOf(count, total) : String(count),
    });
    const ratings = eventRows
      .filter((e) => e.name === 'feedback_submitted')
      .map((e) => (e.metadata ?? {}) as { rating?: number; waitedLonger?: boolean; comment?: string })
      .filter((m) => typeof m.rating === 'number' && m.rating >= 1 && m.rating <= 5);
    const ratingMean = ratings.length ? Math.round((ratings.reduce((a, m) => a + (m.rating as number), 0) / ratings.length) * 10) / 10 : 0;
    const waitedLongerPct = ratings.length ? Math.round((ratings.filter((m) => m.waitedLonger).length / ratings.length) * 100) : 0;
    const distribution = [5, 4, 3, 2, 1].map((star) => ({ star, count: ratings.filter((m) => m.rating === star).length }));

    const SLOTS = ['10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30'];
    const DAYS = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสฯ', 'ศุกร์'];
    const heatRows = DAYS.map((day) => ({ day, cells: SLOTS.map(() => 0), total: 0 }));
    for (const o of cur) {
      const t = new Date(o.orderAt.getTime() + BKK_OFFSET_MS);
      const dayIdx = (t.getUTCDay() + 6) % 7;
      if (dayIdx > 4) continue;
      heatRows[dayIdx].total += 1;
      const slotIdx = Math.floor((t.getUTCHours() * 60 + t.getUTCMinutes() - 10 * 60 - 30) / 30);
      if (slotIdx >= 0 && slotIdx < SLOTS.length) heatRows[dayIdx].cells[slotIdx] += 1;
    }

    // Real figures from however many orders exist (4 orders → "75 %" is shown as is); no orders → null ("no data").
    const rate = (list: typeof orders) => (list.length > 0 ? Math.round((list.filter((o) => o.status === 'done').length / list.length) * 1000) / 10 : null);
    /** Median seconds from order placed to shop acceptance, over orders the shop accepted. */
    const medianAccept = (list: typeof orders): number | null => {
      const secs = list.filter((o) => o.acceptAt).map((o) => Math.max(0, Math.round((o.acceptAt!.getTime() - o.orderAt.getTime()) / 1000))).sort((x, y) => x - y);
      if (secs.length === 0) return null;
      const mid = Math.floor(secs.length / 2);
      return secs.length % 2 ? secs[mid] : Math.round((secs[mid - 1] + secs[mid]) / 2);
    };
    const students = (list: typeof orders) => new Set(list.map((o) => o.userId).filter((id): id is string => !!id && studentIds.has(id))).size;
    // on-time handover = completed orders the shop did not flag as delayed; < 5 completed orders → suppressed (null)
    const onTimeRate = (list: typeof orders) => {
      const done = list.filter((o) => o.status === 'done');
      return done.length < 5 ? null : Math.round((done.filter((o) => !o.isDelay).length / done.length) * 1000) / 10;
    };
    const onTimeNow = onTimeRate(cur);
    const onTimePrev = onTimeRate(prev);
    const onTimeDiff = onTimeNow !== null && onTimePrev !== null ? Math.round((onTimeNow - onTimePrev) * 10) / 10 : null;
    const onTimeDelta =
      onTimeDiff === null
        ? { deltaLabel: 'ไม่มีข้อมูลเทียบ' + period.prevName, good: true, direction: 'up' as const }
        : { deltaLabel: `${onTimeDiff > 0 ? '+' : ''}${onTimeDiff}%`, good: onTimeDiff >= 0, direction: (onTimeDiff >= 0 ? 'up' : 'down') as 'up' | 'down' };
    const doneOrders = cur.filter((o) => o.status === 'done');
    const successRate = rate(cur);
    const successPrev = rate(prev);
    const successDelta = successRate !== null && successPrev !== null ? Math.round((successRate - successPrev) * 10) / 10 : null;
    const acceptNow = medianAccept(cur);
    const acceptPrev = medianAccept(prev);
    const acceptDiff = acceptNow !== null && acceptPrev !== null ? acceptNow - acceptPrev : null;
    const uniqueStudents = students(cur);
    const percentOfEnrolled = school.studentAmount
      ? Math.min(100, Math.round((uniqueStudents / school.studentAmount) * 100))
      : null;

    const revenueOf = (list: typeof orders) => list.filter((o) => o.status === 'done').reduce((a, o) => a + o.totalAmount, 0);
    const restaurantRows = restaurants.map((r) => {
      const restOrders = cur.filter((o) => o.restaurantId === r.restaurantId);
      const delayedOrders = restOrders.filter((o) => o.isDelay);
      const delayRate =
        restOrders.length > 0
          ? Math.round((delayedOrders.length / restOrders.length) * 1000) / 10
          : 0;
      const revenue = revenueOf(restOrders);
      const prevRevenue = revenueOf(prev.filter((o) => o.restaurantId === r.restaurantId));
      return {
        name: r.name,
        orders: restOrders.length,
        acceptLabel: (() => { const m = medianAccept(restOrders); return m === null ? '-' : `${m} วิ`; })(),
        delayRate,
        rejected: restOrders.filter((o) => o.status === 'rejected').length,
        revenue,
        revenueDeltaPct: prevRevenue > 0 ? Math.round(((revenue - prevRevenue) / prevRevenue) * 1000) / 10 : null,
        status: r.status,
      };
    });

    return {
      weekLabel: period.label,
      weekNumber: period.weekNumber,
      kpis: {
        totalOrders: { value: cur.length, ...pctDelta(cur.length, prev.length, period.prevName) },
        activeStudents: {
          value: uniqueStudents,
          enrolled: school.studentAmount ?? null,
          percentOfEnrolled,
          ...pctDelta(uniqueStudents, students(prev), period.prevName),
        },
        successRate: {
          value: successRate,
          deltaLabel: successDelta === null ? `จาก ${cur.length} ออเดอร์` : `${successDelta > 0 ? '+' : ''}${successDelta}% จาก${period.prevName} (จาก ${cur.length} ออเดอร์)`,
          good: (successDelta ?? 0) >= 0,
          direction: (successDelta ?? 0) >= 0 ? 'up' : 'down',
        },
        medianAcceptSeconds: {
          value: acceptNow,
          deltaLabel: acceptDiff === null ? 'ยังไม่มีข้อมูลเทียบ' : acceptDiff === 0 ? `เท่ากับ${period.prevName}` : `${acceptDiff < 0 ? 'เร็วขึ้น' : 'ช้าลง'} ${Math.abs(acceptDiff)} วินาที`,
          good: acceptDiff === null || acceptDiff <= 0,
          direction: acceptDiff !== null && acceptDiff > 0 ? 'up' : 'down',
        },
        rating: {
          value: ratings.length ? ratingMean : null,
          responses: ratings.length,
          deltaLabel: ratings.length ? `จาก ${ratings.length} ความเห็น` : 'ยังไม่มีความเห็น',
          good: true,
          direction: 'up',
        },
        onTime: { value: onTimeRate(cur), ...onTimeDelta },
        refunds: { value: refundsCur, ...pctDelta(refundsCur, refundsPrev, period.prevName, true) },
      },
      ordersByDay: [
        { label: 'จ.', count: cur.filter((o) => new Date(o.orderAt).getDay() === 1).length },
        { label: 'อ.', count: cur.filter((o) => new Date(o.orderAt).getDay() === 2).length },
        { label: 'พ.', count: cur.filter((o) => new Date(o.orderAt).getDay() === 3).length },
        { label: 'พฤ.', count: cur.filter((o) => new Date(o.orderAt).getDay() === 4).length },
        { label: 'ศ.', count: cur.filter((o) => new Date(o.orderAt).getDay() === 5).length },
      ],
      reliability: [
        reliabilityRow('ยกเลิกโดยร้าน', 'ร้านกดปฏิเสธ', cur.filter((o) => o.status === 'rejected').length, cur.length),
        reliabilityRow('ร้านไม่กดรับทันเวลา', 'ระบบยกเลิกอัตโนมัติ 3 นาที', eventCount('order_auto_rejected', 'order_auto_cancelled'), cur.length),
        reliabilityRow('ทำเสร็จช้ากว่าที่แจ้ง', 'ร้านกดแจ้งล่าช้า', cur.filter((o) => o.isDelay).length, cur.length),
        reliabilityRow('ตรวจสลิปไม่ผ่าน', 'ต่อสลิปที่ส่งทั้งหมด', eventCount('payment_verification_failed'), cur.length),
        reliabilityRow('ออเดอร์ซ้ำ', 'ระบบตรวจพบและกันไว้', eventCount('duplicate_order_detected'), cur.length, false),
      ],
      heatmap: { slots: SLOTS, rows: heatRows },
      restaurants: restaurantRows,
      feedback: {
        mean: ratingMean,
        responses: ratings.length,
        distribution,
        waitedLongerPct,
        comments: allComments,
      },
    };
  }

  // ---------------------------------------------------------------- hours & overrides

  async getSchoolHours(schoolId: string) {
    return this.prisma.schoolOperatingHour.findMany({
      where: { schoolId },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  async saveSchoolHours(schoolId: string, hours: any[]) {
    return this.prisma.$transaction(async (tx) => {
      await tx.schoolOperatingHour.deleteMany({ where: { schoolId } });
      if (hours && hours.length > 0) {
        await tx.schoolOperatingHour.createMany({
          data: hours.map((h) => ({
            schoolId,
            dayOfWeek: h.dayOfWeek,
            openMinute: h.openMinute,
            closeMinute: h.closeMinute,
          })),
        });
      }
      return tx.schoolOperatingHour.findMany({
        where: { schoolId },
        orderBy: { dayOfWeek: 'asc' },
      });
    });
  }

  async getSchoolOverrides(schoolId: string) {
    return this.prisma.schoolDateOverride.findMany({
      where: { schoolId },
      orderBy: { date: 'asc' },
    });
  }

  async saveSchoolOverrides(schoolId: string, overrides: any[]) {
    return this.prisma.$transaction(async (tx) => {
      await tx.schoolDateOverride.deleteMany({ where: { schoolId } });
      if (overrides && overrides.length > 0) {
        await tx.schoolDateOverride.createMany({
          data: overrides.map((o) => ({
            schoolId,
            date: new Date(o.date),
            isClosed: Boolean(o.isClosed),
            openMinute: o.openMinute ?? null,
            closeMinute: o.closeMinute ?? null,
            reason: o.reason ?? null,
          })),
        });
      }
      return tx.schoolDateOverride.findMany({
        where: { schoolId },
        orderBy: { date: 'asc' },
      });
    });
  }
}
