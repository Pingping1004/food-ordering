import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InviteCodeType,
  MembershipStatus,
  Prisma,
  RestaurantRole,
  Role,
  SchoolRole,
  Status,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  formatInviteCode,
  isValidInviteCodeShape,
  normaliseInviteCode,
} from '../utils/invite-code';
import { generateGloballyUniqueCode } from './unique-code';
import { schoolSuspendedException } from '../access/school-suspended';

/** One message for every kind of bad code so the response never says what a code is (or was). */
export const INVALID_CODE_MESSAGE = 'รหัสเชิญไม่ถูกต้องหรือหมดอายุ';
export const OTHER_SCHOOL_MESSAGE =
  'คุณเข้าร่วมโรงเรียนอื่นแล้ว หากต้องการเปลี่ยนโรงเรียนให้ไปที่การตั้งค่า';

const DAY_MS = 24 * 60 * 60 * 1000;
const LIVE_MEMBERSHIP: MembershipStatus[] = [
  MembershipStatus.PENDING,
  MembershipStatus.APPROVED,
];

/** Max school admins (live memberships + unredeemed admin-code uses) per school. */
export const MAX_SCHOOL_ADMINS = 5;
const ADMIN_LIMIT_MESSAGE = `โรงเรียนหนึ่งมีผู้ดูแลได้ไม่เกิน ${MAX_SCHOOL_ADMINS} คน`;

export const SHOP_OWNER_DEFAULTS = { maxUses: 1, expiresInDays: 14 };
export const SCHOOL_ADMIN_DEFAULTS = { maxUses: 1, expiresInDays: 7 };

export type RedeemResult = {
  type: InviteCodeType;
  school: { schoolId: string; name: string };
  restaurant?: { restaurantId: string; name: string };
  status: 'ACTIVE' | 'PENDING';
};

type CodeRow = {
  id: string;
  code: string;
  type: InviteCodeType;
  schoolId: string;
  restaurantId: string | null;
  maxUses: number;
  usedCount: number;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  restaurant?: { name: string } | null;
};

@Injectable()
export class InviteCodeService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------- redeem

  async redeem(userId: string, rawCode: string): Promise<RedeemResult> {
    if (!isValidInviteCodeShape(rawCode))
      throw new BadRequestException(INVALID_CODE_MESSAGE);
    const code = normaliseInviteCode(rawCode);

    // Always run both lookups so timing does not depend on which kind of code it is.
    const [typed, student, user] = await Promise.all([
      this.prisma.inviteCode.findUnique({
        where: { code },
        include: {
          school: { select: { schoolId: true, name: true, status: true } },
          restaurant: {
            select: { restaurantId: true, name: true, status: true },
          },
          createdBy: { select: { role: true } },
        },
      }),
      this.prisma.school.findFirst({
        where: {
          inviteCode: code,
          status: { in: [Status.ACTIVE, Status.SUSPENDED] },
        },
        select: { schoolId: true, name: true, status: true },
      }),
      this.prisma.user.findUnique({
        where: { userId },
        select: { schoolId: true },
      }),
    ]);
    if (!user) throw new NotFoundException('ไม่พบผู้ใช้งาน');

    // A suspended school gets a clear message (instead of the generic invalid-code error).
    const typedLive =
      typed &&
      !typed.revokedAt &&
      (!typed.expiresAt || typed.expiresAt > new Date());
    if (
      (typed && typedLive && typed.school.status === Status.SUSPENDED) ||
      (!typed && student?.status === Status.SUSPENDED)
    )
      throw schoolSuspendedException();

    if (typed) return this.redeemTyped(userId, user.schoolId, typed);
    if (student) return this.redeemStudent(userId, user.schoolId, student);
    throw new BadRequestException(INVALID_CODE_MESSAGE);
  }

  private async redeemStudent(
    userId: string,
    currentSchoolId: string | null,
    school: { schoolId: string; name: string },
  ): Promise<RedeemResult> {
    const result: RedeemResult = {
      type: InviteCodeType.STUDENT,
      school: { schoolId: school.schoolId, name: school.name },
      status: 'ACTIVE',
    };
    if (currentSchoolId === school.schoolId) return result;
    if (currentSchoolId) throw new ConflictException(OTHER_SCHOOL_MESSAGE);

    const adminApplication = await this.prisma.schoolMembership.findFirst({
      where: {
        userId,
        role: SchoolRole.ADMIN,
        status: { in: LIVE_MEMBERSHIP },
        school: { status: { not: Status.REMOVED } },
      },
      select: { id: true },
    });
    if (adminApplication)
      throw new ConflictException('คุณมีคำขอเป็นผู้ดูแลโรงเรียนอยู่แล้ว');

    const { count } = await this.prisma.user.updateMany({
      where: { userId, schoolId: null },
      data: { schoolId: school.schoolId },
    });
    if (count === 0) throw new ConflictException(OTHER_SCHOOL_MESSAGE);
    return result;
  }

  private isUsable(
    code: CodeRow & {
      school: { status: Status };
      restaurant?: { status: Status } | null;
    },
    now: Date,
  ): boolean {
    if (code.revokedAt) return false;
    if (code.expiresAt && code.expiresAt <= now) return false;
    if (code.school.status !== Status.ACTIVE) return false;
    if (
      code.type === InviteCodeType.SHOP_STAFF &&
      (!code.restaurant || code.restaurant.status === Status.REMOVED)
    )
      return false;
    return true;
  }

  private async redeemTyped(
    userId: string,
    currentSchoolId: string | null,
    code: any,
  ): Promise<RedeemResult> {
    const now = new Date();
    if (!this.isUsable(code, now))
      throw new BadRequestException(INVALID_CODE_MESSAGE);
    if (currentSchoolId && currentSchoolId !== code.schoolId)
      throw new ConflictException(OTHER_SCHOOL_MESSAGE);

    const existing = await this.prisma.inviteRedemption.findUnique({
      where: { codeId_userId: { codeId: code.id, userId } },
      select: { id: true },
    });
    if (!existing) {
      if (code.maxUses > 0 && code.usedCount >= code.maxUses)
        throw new BadRequestException(INVALID_CODE_MESSAGE);
      try {
        await this.prisma.$transaction(async (tx) => {
          // Compare-and-set so two concurrent redemptions cannot exceed maxUses.
          const { count } = await tx.inviteCode.updateMany({
            where: {
              id: code.id,
              revokedAt: null,
              ...(code.maxUses > 0 ? { usedCount: { lt: code.maxUses } } : {}),
            },
            data: { usedCount: { increment: 1 } },
          });
          if (count === 0) throw new BadRequestException(INVALID_CODE_MESSAGE);
          await tx.inviteRedemption.create({
            data: { codeId: code.id, userId },
          });
        });
      } catch (err) {
        // Lost a race against ourselves (double click): the other request created the redemption, so this is a repeat.
        const duplicate =
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002';
        if (!duplicate) throw err;
      }
    }

    // Effects are idempotent, so repeating them for an existing redemption is harmless and self-healing.
    const status = await this.applyEffect(userId, code);
    return {
      type: code.type,
      school: { schoolId: code.school.schoolId, name: code.school.name },
      ...(code.type === InviteCodeType.SHOP_STAFF && code.restaurant
        ? {
            restaurant: {
              restaurantId: code.restaurant.restaurantId,
              name: code.restaurant.name,
            },
          }
        : {}),
      status,
    };
  }

  private async applyEffect(
    userId: string,
    code: any,
  ): Promise<'ACTIVE' | 'PENDING'> {
    const schoolId: string = code.schoolId;
    await this.prisma.user.updateMany({
      where: { userId, OR: [{ schoolId: null }, { schoolId }] },
      data: { schoolId },
    });

    if (code.type === InviteCodeType.SHOP_OWNER) return 'ACTIVE';

    if (code.type === InviteCodeType.SHOP_STAFF) {
      const restaurantId: string = code.restaurantId;
      const existing = await this.prisma.restaurantMembership.findUnique({
        where: { userId_restaurantId: { userId, restaurantId } },
      });
      if (existing?.status === MembershipStatus.APPROVED) return 'ACTIVE';
      if (existing?.status === MembershipStatus.PENDING) return 'PENDING';
      if (existing) {
        await this.prisma.restaurantMembership.update({
          where: { id: existing.id },
          data: {
            role: RestaurantRole.STAFF,
            status: MembershipStatus.PENDING,
          },
        });
      } else {
        await this.prisma.restaurantMembership.create({
          data: {
            userId,
            restaurantId,
            role: RestaurantRole.STAFF,
            status: MembershipStatus.PENDING,
          },
        });
      }
      return 'PENDING';
    }

    // SCHOOL_ADMIN. A code issued by a system admin IS the approval (the sysadmin vouched for the holder);
    // a code issued by a school admin stays PENDING until an existing admin approves.
    const issuedBySysadmin = code.createdBy?.role === Role.ADMIN;
    const target = issuedBySysadmin
      ? MembershipStatus.APPROVED
      : MembershipStatus.PENDING;
    const targetResult = issuedBySysadmin ? 'ACTIVE' : 'PENDING';

    const existing = await this.prisma.schoolMembership.findUnique({
      where: { userId_schoolId: { userId, schoolId } },
    });
    if (
      existing?.status === MembershipStatus.APPROVED &&
      existing.role === SchoolRole.ADMIN
    )
      return 'ACTIVE';
    if (
      existing?.status === MembershipStatus.PENDING &&
      existing.role === SchoolRole.ADMIN &&
      !issuedBySysadmin
    )
      return 'PENDING';
    const isLiveAdmin =
      existing?.role === SchoolRole.ADMIN &&
      existing.status === MembershipStatus.PENDING;
    if (!isLiveAdmin) {
      const admins = await this.prisma.schoolMembership.count({
        where: { schoolId, role: SchoolRole.ADMIN, status: { in: LIVE_MEMBERSHIP } },
      });
      if (admins >= MAX_SCHOOL_ADMINS)
        throw new ConflictException(ADMIN_LIMIT_MESSAGE);
    }
    if (existing) {
      await this.prisma.schoolMembership.update({
        where: { id: existing.id },
        data: { role: SchoolRole.ADMIN, status: target },
      });
    } else {
      await this.prisma.schoolMembership.create({
        data: { userId, schoolId, role: SchoolRole.ADMIN, status: target },
      });
    }
    return targetResult;
  }

  // ---------------------------------------------------------------- management (school admin / sysadmin)

  private toItem(c: CodeRow, now = new Date()) {
    const state = c.revokedAt
      ? 'REVOKED'
      : c.expiresAt && c.expiresAt <= now
        ? 'EXPIRED'
        : c.maxUses > 0 && c.usedCount >= c.maxUses
          ? 'USED_UP'
          : 'ACTIVE';
    return {
      id: c.id,
      code: formatInviteCode(c.code),
      type: c.type,
      restaurantId: c.restaurantId,
      restaurantName: c.restaurant?.name ?? null,
      maxUses: c.maxUses,
      usedCount: c.usedCount,
      expiresAt: c.expiresAt,
      revokedAt: c.revokedAt,
      revoked: !!c.revokedAt,
      state,
      createdAt: c.createdAt,
    };
  }

  async listSchoolCodes(schoolId: string, type?: InviteCodeType) {
    const rows = await this.prisma.inviteCode.findMany({
      where: { schoolId, type: type ? type : { not: InviteCodeType.STUDENT } },
      orderBy: { createdAt: 'desc' },
      include: { restaurant: { select: { name: true } } },
    });
    return rows.map((r) => this.toItem(r));
  }

  async createSchoolCode(
    schoolId: string,
    createdById: string,
    dto: {
      type: 'SHOP_OWNER' | 'SCHOOL_ADMIN';
      maxUses?: number;
      expiresInDays?: number;
    },
  ) {
    if (
      dto.type !== InviteCodeType.SHOP_OWNER &&
      dto.type !== InviteCodeType.SCHOOL_ADMIN
    ) {
      throw new BadRequestException('ชนิดรหัสไม่ถูกต้อง');
    }
    const school = await this.prisma.school.findUnique({
      where: { schoolId },
      select: { status: true },
    });
    if (!school) throw new NotFoundException('ไม่พบโรงเรียน');
    if (school.status !== Status.ACTIVE)
      throw new ConflictException('โรงเรียนนี้ยังไม่ได้รับการอนุมัติ');

    const defaults =
      dto.type === InviteCodeType.SHOP_OWNER
        ? SHOP_OWNER_DEFAULTS
        : SCHOOL_ADMIN_DEFAULTS;
    if (dto.type === InviteCodeType.SCHOOL_ADMIN) {
      const uses = dto.maxUses ?? defaults.maxUses;
      if (uses < 1) throw new BadRequestException(ADMIN_LIMIT_MESSAGE);
      const now = new Date();
      const [admins, open] = await Promise.all([
        this.prisma.schoolMembership.count({
          where: { schoolId, role: SchoolRole.ADMIN, status: { in: LIVE_MEMBERSHIP } },
        }),
        this.prisma.inviteCode.findMany({
          where: {
            schoolId,
            type: InviteCodeType.SCHOOL_ADMIN,
            revokedAt: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          select: { maxUses: true, usedCount: true },
        }),
      ]);
      const reserved = open.reduce(
        (n, c) => n + Math.max(0, c.maxUses - c.usedCount),
        0,
      );
      if (admins + reserved + uses > MAX_SCHOOL_ADMINS)
        throw new ConflictException(
          `${ADMIN_LIMIT_MESSAGE} (ตอนนี้มี ${admins} คน และรหัสที่ยังใช้ได้อีก ${reserved} ครั้ง)`,
        );
    }
    const code = await generateGloballyUniqueCode(this.prisma);
    const row = await this.prisma.inviteCode.create({
      data: {
        code,
        type: dto.type,
        schoolId,
        createdById,
        maxUses: dto.maxUses ?? defaults.maxUses,
        expiresAt: (dto.expiresInDays ?? defaults.expiresInDays)
          ? new Date(
              Date.now() +
                (dto.expiresInDays ?? defaults.expiresInDays) * DAY_MS,
            )
          : null, // 0 = never expires
      },
      include: { restaurant: { select: { name: true } } },
    });
    return this.toItem(row);
  }

  /** Type of a non-student code of this school (404 otherwise). */
  async getSchoolCodeType(schoolId: string, codeId: string) {
    const row = await this.prisma.inviteCode.findFirst({
      where: { id: codeId, schoolId, type: { not: InviteCodeType.STUDENT } },
      select: { type: true },
    });
    if (!row) throw new NotFoundException('ไม่พบรหัสเชิญ');
    return row.type;
  }

  /** Revoke any non-student code of this school (school admin / sysadmin). */
  async revokeSchoolCode(schoolId: string, codeId: string) {
    const row = await this.prisma.inviteCode.findFirst({
      where: { id: codeId, schoolId, type: { not: InviteCodeType.STUDENT } },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('ไม่พบรหัสเชิญ');
    await this.prisma.inviteCode.updateMany({
      where: { id: codeId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { revoked: true };
  }

  /** Permanently delete a non-student code of this school; only codes that are no longer usable (revoked / used up / expired). */
  async deleteSchoolCode(schoolId: string, codeId: string) {
    const row = await this.prisma.inviteCode.findFirst({
      where: { id: codeId, schoolId, type: { not: InviteCodeType.STUDENT } },
      include: { restaurant: { select: { name: true } } },
    });
    return this.deleteInactive(row);
  }

  private async deleteInactive(row: CodeRow | null) {
    if (!row) throw new NotFoundException('ไม่พบรหัสเชิญ');
    if (this.toItem(row).state === 'ACTIVE')
      throw new ConflictException('ลบได้เฉพาะรหัสที่ใช้ครบแล้ว หมดอายุ หรือถูกยกเลิก');
    await this.prisma.inviteCode.delete({ where: { id: row.id } });
    return { deleted: true };
  }

  // ---------------------------------------------------------------- management (shop owner)

  private async getRestaurant(restaurantId: string) {
    const r = await this.prisma.restaurant.findUnique({
      where: { restaurantId },
      select: {
        restaurantId: true,
        name: true,
        status: true,
        canteen: { select: { schoolId: true } },
      },
    });
    if (!r) throw new NotFoundException('ไม่พบร้านอาหาร');
    return r;
  }

  async listStaffCodes(restaurantId: string) {
    await this.getRestaurant(restaurantId);
    const rows = await this.prisma.inviteCode.findMany({
      where: { restaurantId, type: InviteCodeType.SHOP_STAFF },
      orderBy: { createdAt: 'desc' },
      include: { restaurant: { select: { name: true } } },
    });
    return rows.map((r) => this.toItem(r));
  }

  async createStaffCode(
    restaurantId: string,
    createdById: string,
    dto: { expiresInDays?: number },
  ) {
    const restaurant = await this.getRestaurant(restaurantId);
    if (restaurant.status === Status.REMOVED)
      throw new ConflictException('ร้านนี้ถูกลบแล้ว');

    const code = await generateGloballyUniqueCode(this.prisma);
    const row = await this.prisma.inviteCode.create({
      data: {
        code,
        type: InviteCodeType.SHOP_STAFF,
        schoolId: restaurant.canteen.schoolId,
        restaurantId,
        createdById,
        maxUses: 0, // unlimited, reusable until revoked
        expiresAt: dto.expiresInDays
          ? new Date(Date.now() + dto.expiresInDays * DAY_MS)
          : null,
      },
      include: { restaurant: { select: { name: true } } },
    });
    return this.toItem(row);
  }

  async revokeStaffCode(restaurantId: string, codeId: string) {
    const row = await this.prisma.inviteCode.findFirst({
      where: { id: codeId, restaurantId, type: InviteCodeType.SHOP_STAFF },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('ไม่พบรหัสเชิญ');
    await this.prisma.inviteCode.updateMany({
      where: { id: codeId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { revoked: true };
  }

  async deleteStaffCode(restaurantId: string, codeId: string) {
    const row = await this.prisma.inviteCode.findFirst({
      where: { id: codeId, restaurantId, type: InviteCodeType.SHOP_STAFF },
      include: { restaurant: { select: { name: true } } },
    });
    return this.deleteInactive(row);
  }
}
