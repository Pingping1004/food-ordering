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
  SchoolRole,
  Status,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import moment from 'moment-timezone';
import { isDebugAlwaysOpen } from '../utils/debug';
import {
  formatInviteCode,
  isValidInviteCodeShape,
  normaliseInviteCode,
} from '../utils/invite-code';
import { generateGloballyUniqueCode } from '../invite/unique-code';
import {
  INVALID_CODE_MESSAGE,
  SCHOOL_ADMIN_DEFAULTS,
} from '../invite/invite-code.service';
import { CreateSchoolDto, UpdateSchoolDto } from './dto/school.dto';
import { schoolSuspendedException } from '../access/school-suspended';
import { invalidateRestaurantVisibility } from '../access/restaurant-visibility.cache';

export interface SchoolBlocker {
  code: 'HAS_RESTAURANT' | 'HAS_SCHOOL_ADMIN_ROLE';
  restaurantId?: string;
  schoolId?: string;
  name?: string;
}

const LIVE_MEMBERSHIP: MembershipStatus[] = [
  MembershipStatus.PENDING,
  MembershipStatus.APPROVED,
];

@Injectable()
export class SchoolService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------- today's opening status

  async getUserSchoolId(userId: string): Promise<string | null> {
    const u = await this.prisma.user.findUnique({ where: { userId }, select: { schoolId: true } });
    return u?.schoolId ?? null;
  }

  async getDayStatus(schoolId: string) {
    const now = moment().tz('Asia/Bangkok');
    const horizon = now.clone().add(14, 'days').endOf('day');
    const school = await this.prisma.school.findUnique({
      where: { schoolId },
      select: {
        operatingHours: true,
        dateOverrides: {
          where: {
            date: {
              gte: now.clone().startOf('day').toDate(),
              lte: horizon.toDate(),
            },
          },
        },
      },
    });
    if (!school) throw new NotFoundException('ไม่พบโรงเรียน');

    const DOW = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const overrides = new Map(
      school.dateOverrides.map((o) => [moment.utc(o.date).format('YYYY-MM-DD'), o]),
    );
    const configured = school.operatingHours.length > 0;

    type Day = { open: number | null; close: number | null; reason: string | null; special: boolean };
    const dayInfo = (d: moment.Moment): Day => {
      const ov = overrides.get(d.format('YYYY-MM-DD'));
      if (ov?.isClosed) return { open: null, close: null, reason: ov.reason ?? 'โรงเรียนปิดทำการ', special: true };
      if (ov && ov.openMinute != null && ov.closeMinute != null)
        return { open: ov.openMinute, close: ov.closeMinute, reason: null, special: true };
      if (!configured) return { open: 0, close: 1440, reason: null, special: false };
      const row = school.operatingHours.find((h) => h.dayOfWeek === DOW[d.day()]);
      return row
        ? { open: row.openMinute, close: row.closeMinute, reason: null, special: false }
        : { open: null, close: null, reason: 'วันนี้โรงอาหารไม่เปิดทำการตามตารางประจำสัปดาห์', special: false };
    };
    const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const at = (d: moment.Moment, minute: number) => d.clone().startOf('day').add(minute, 'minutes');

    const today = dayInfo(now);
    const minuteNow = now.hours() * 60 + now.minutes();
    let isOpen = today.open !== null && minuteNow >= today.open && minuteNow < (today.close ?? 0);
    let reason: string | null = null;
    if (!isOpen) {
      reason =
        today.open === null
          ? today.reason
          : minuteNow < today.open
            ? `ยังไม่ถึงเวลาเปิด (เปิด ${hhmm(today.open)})`
            : 'ปิดทำการแล้วสำหรับวันนี้';
    }
    if (isDebugAlwaysOpen()) {
      isOpen = true;
      reason = null;
    }

    // Next opening moment (later today, or the next open day within two weeks).
    let nextOpenAt: string | null = null;
    for (let i = 0; i <= 14 && !nextOpenAt; i++) {
      const d = now.clone().add(i, 'days');
      const info = dayInfo(d);
      if (info.open === null) continue;
      const when = at(d, info.open);
      if (when.isAfter(now)) nextOpenAt = when.toISOString();
    }

    const upcoming: { date: string; label: string; closed: boolean; hoursLabel: string | null }[] = [];
    for (let i = 1; i <= 14 && upcoming.length < 5; i++) {
      const d = now.clone().add(i, 'days');
      const info = dayInfo(d);
      // Only unusual days: a holiday / date override, not the regular weekend.
      if (!info.special) continue;
      upcoming.push({
        date: d.format('YYYY-MM-DD'),
        label: d.toDate().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' }),
        closed: info.open === null,
        hoursLabel: info.open === null ? null : `${hhmm(info.open)}–${hhmm(info.close ?? 0)}`,
      });
    }

    return { isOpen, reason, date: now.format('YYYY-MM-DD'), nextOpenAt, upcoming };
  }

  // ---------------------------------------------------------------- invite codes

  /** Unique 8-char code (storage form), unique across School.inviteCode and InviteCode.code. */
  generateUniqueInviteCode(): Promise<string> {
    return generateGloballyUniqueCode(this.prisma);
  }

  /** Generic failure for malformed / unknown / inactive codes so nothing about valid codes leaks. */
  private async resolveSchoolByCode(rawCode: string) {
    if (!isValidInviteCodeShape(rawCode))
      throw new BadRequestException(INVALID_CODE_MESSAGE);
    const school = await this.prisma.school.findFirst({
      where: {
        inviteCode: normaliseInviteCode(rawCode),
        status: { in: [Status.ACTIVE, Status.SUSPENDED] },
      },
      select: { schoolId: true, name: true, status: true },
    });
    if (!school) throw new BadRequestException(INVALID_CODE_MESSAGE);
    if (school.status === Status.SUSPENDED) throw schoolSuspendedException();
    return school;
  }

  // ---------------------------------------------------------------- self: join / change / read

  /** What stops a user from joining or switching school. */
  async findSchoolBlockers(userId: string): Promise<SchoolBlocker[]> {
    const [restaurants, schools] = await Promise.all([
      this.prisma.restaurantMembership.findMany({
        where: {
          userId,
          status: { in: LIVE_MEMBERSHIP },
          restaurant: { status: { not: Status.REMOVED } },
        },
        select: { restaurantId: true, restaurant: { select: { name: true } } },
      }),
      this.prisma.schoolMembership.findMany({
        where: {
          userId,
          role: SchoolRole.ADMIN,
          status: { in: LIVE_MEMBERSHIP },
          school: { status: { not: Status.REMOVED } },
        },
        select: { schoolId: true, school: { select: { name: true } } },
      }),
    ]);

    return [
      ...restaurants.map((r) => ({
        code: 'HAS_RESTAURANT' as const,
        restaurantId: r.restaurantId,
        name: r.restaurant.name,
      })),
      ...schools.map((s) => ({
        code: 'HAS_SCHOOL_ADMIN_ROLE' as const,
        schoolId: s.schoolId,
        name: s.school.name,
      })),
    ];
  }

  /** STUDENT code only (the school's own invite code). Used by changeSchool when the user has no school yet. */
  async joinSchool(userId: string, rawCode: string) {
    const user = await this.prisma.user.findUnique({
      where: { userId },
      select: { schoolId: true },
    });
    if (!user) throw new NotFoundException('ไม่พบผู้ใช้งาน');
    if (user.schoolId)
      throw new ConflictException(
        'คุณเข้าร่วมโรงเรียนแล้ว หากต้องการเปลี่ยนโรงเรียนให้ไปที่การตั้งค่า',
      );

    const blockers = await this.findSchoolBlockers(userId);
    if (blockers.length > 0) {
      throw new ConflictException({
        message: 'ไม่สามารถเข้าร่วมโรงเรียนอื่นได้ในขณะนี้',
        blockers,
      });
    }

    const school = await this.resolveSchoolByCode(rawCode);
    // Compare-and-set so two concurrent joins cannot both win.
    const { count } = await this.prisma.user.updateMany({
      where: { userId, schoolId: null },
      data: { schoolId: school.schoolId },
    });
    if (count === 0) throw new ConflictException('คุณเข้าร่วมโรงเรียนแล้ว');

    return { school: { schoolId: school.schoolId, name: school.name } };
  }

  async changeSchool(userId: string, rawCode: string) {
    const user = await this.prisma.user.findUnique({
      where: { userId },
      select: { schoolId: true },
    });
    if (!user) throw new NotFoundException('ไม่พบผู้ใช้งาน');
    if (!user.schoolId) return this.joinSchool(userId, rawCode);

    const blockers = await this.findSchoolBlockers(userId);
    if (blockers.length > 0) {
      throw new ConflictException({
        message:
          'ไม่สามารถเปลี่ยนโรงเรียนได้ เนื่องจากคุณมีร้านค้าหรือสิทธิ์ผู้ดูแลโรงเรียนอยู่',
        blockers,
      });
    }

    const school = await this.resolveSchoolByCode(rawCode);
    if (school.schoolId !== user.schoolId) {
      await this.prisma.user.update({
        where: { userId },
        data: { schoolId: school.schoolId },
      });
    }
    return { school: { schoolId: school.schoolId, name: school.name } };
  }

  /** Name + canteens of the caller's own school. Never includes the invite code. */
  async getMySchool(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { userId },
      select: { schoolId: true },
    });
    if (!user?.schoolId)
      throw new NotFoundException('คุณยังไม่ได้เข้าร่วมโรงเรียน');

    const school = await this.prisma.school.findUnique({
      where: { schoolId: user.schoolId },
      select: {
        schoolId: true,
        name: true,
        profile: true,
        canteens: {
          where: { status: Status.ACTIVE },
          orderBy: { name: 'asc' },
          select: { canteenId: true, name: true, profile: true },
        },
      },
    });
    if (!school) throw new NotFoundException('ไม่พบโรงเรียน');
    return school;
  }

  async getCanteenRestaurants(userId: string, canteenId: string) {
    const user = await this.prisma.user.findUnique({
      where: { userId },
      select: { schoolId: true },
    });
    if (!user?.schoolId) throw new NotFoundException('ไม่พบข้อมูล');

    const canteen = await this.prisma.canteen.findFirst({
      where: { canteenId, schoolId: user.schoolId, status: Status.ACTIVE },
      select: { canteenId: true },
    });
    if (!canteen) throw new NotFoundException('ไม่พบข้อมูล');

    return this.prisma.restaurant.findMany({
      where: { canteenId, status: Status.ACTIVE },
      orderBy: { name: 'asc' },
      select: {
        restaurantId: true,
        name: true,
        profile: true,
        location: true,
        categories: true,
        avgCookingTimeMins: true,
        canteenId: true,
      },
    });
  }

  // ---------------------------------------------------------------- create (system admin)

  /**
   * System admin creates a school: ACTIVE school + student code + the first SCHOOL_ADMIN invite code,
   * all in one transaction (either everything exists or nothing does).
   */
  async createSchool(createdById: string, dto: CreateSchoolDto) {
    const name = dto.name.trim();
    const email = dto.email.trim().toLowerCase();

    const [nameTaken, emailTaken] = await Promise.all([
      this.prisma.school.findFirst({
        where: { name },
        select: { schoolId: true },
      }),
      this.prisma.school.findFirst({
        where: { email },
        select: { schoolId: true },
      }),
    ]);
    if (nameTaken) throw new ConflictException('ชื่อโรงเรียนนี้ถูกใช้แล้ว');
    if (emailTaken)
      throw new ConflictException('อีเมลของโรงเรียนนี้ถูกใช้แล้ว');

    const studentCode = await this.generateUniqueInviteCode();
    let adminCodeValue = await this.generateUniqueInviteCode();
    while (adminCodeValue === studentCode)
      adminCodeValue = await this.generateUniqueInviteCode();
    const expiresAt = new Date(
      Date.now() + SCHOOL_ADMIN_DEFAULTS.expiresInDays * 24 * 60 * 60 * 1000,
    );

    try {
      return await this.prisma.$transaction(async (tx) => {
        const school = await tx.school.create({
          data: {
            name,
            email,
            studentAmount: dto.studentAmount ?? 0,
            profile: dto.profile ?? null,
            status: Status.ACTIVE,
            inviteCode: studentCode,
            createdById,
          },
        });
        const adminCode = await tx.inviteCode.create({
          data: {
            code: adminCodeValue,
            type: InviteCodeType.SCHOOL_ADMIN,
            schoolId: school.schoolId,
            createdById,
            maxUses: SCHOOL_ADMIN_DEFAULTS.maxUses,
            expiresAt,
          },
        });
        return {
          school: this.formatAdminItem(school, null),
          adminCode: {
            id: adminCode.id,
            code: formatInviteCode(adminCode.code),
            expiresAt: adminCode.expiresAt,
          },
        };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('ชื่อหรืออีเมลของโรงเรียนนี้ถูกใช้แล้ว');
      }
      throw error;
    }
  }

  // ---------------------------------------------------------------- system admin

  private async toAdminItem(school: {
    schoolId: string;
    name: string;
    email: string;
    profile: string | null;
    studentAmount: number;
    status: Status;
    inviteCode: string | null;
    createdById: string | null;
    createdAt: Date;
  }) {
    const applicant = school.createdById
      ? await this.prisma.user.findUnique({
          where: { userId: school.createdById },
          select: { userId: true, name: true, email: true },
        })
      : null;
    return this.formatAdminItem(school, applicant);
  }

  private formatAdminItem(
    school: {
      schoolId: string;
      name: string;
      email: string;
      profile: string | null;
      studentAmount: number;
      status: Status;
      inviteCode: string | null;
      createdAt: Date;
    },
    applicant: { userId: string; name: string; email: string | null } | null,
  ) {
    return {
      schoolId: school.schoolId,
      name: school.name,
      email: school.email,
      profile: school.profile,
      studentAmount: school.studentAmount,
      status: school.status,
      inviteCode: school.inviteCode
        ? formatInviteCode(school.inviteCode)
        : null,
      createdAt: school.createdAt,
      applicant,
    };
  }

  async listSchools(status?: Status) {
    const schools = await this.prisma.school.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    const ids = [
      ...new Set(
        schools.map((s) => s.createdById).filter((id): id is string => !!id),
      ),
    ];
    const users = ids.length
      ? await this.prisma.user.findMany({
          where: { userId: { in: ids } },
          select: { userId: true, name: true, email: true },
        })
      : [];
    const byId = new Map(users.map((u) => [u.userId, u]));
    // School-admin code usage per school: times used / total use limit over codes that were not revoked.
    const codes = await this.prisma.inviteCode.groupBy({
      by: ['schoolId'],
      where: {
        schoolId: { in: schools.map((s) => s.schoolId) },
        type: InviteCodeType.SCHOOL_ADMIN,
        revokedAt: null,
      },
      _sum: { usedCount: true, maxUses: true },
    });
    const usage = new Map(codes.map((c) => [c.schoolId, c._sum]));
    return schools.map((s) => ({
      ...this.formatAdminItem(
        s,
        s.createdById ? (byId.get(s.createdById) ?? null) : null,
      ),
      adminCodeUsed: usage.get(s.schoolId)?.usedCount ?? 0,
      adminCodeLimit: usage.get(s.schoolId)?.maxUses ?? 0,
    }));
  }

  async getSchoolAsAdmin(schoolId: string) {
    const school = await this.prisma.school.findUnique({ where: { schoolId } });
    if (!school) throw new NotFoundException('ไม่พบโรงเรียน');
    return this.toAdminItem(school);
  }

  /** Used by both sysadmin and school admin routes. */
  async rotateInviteCode(schoolId: string) {
    const school = await this.prisma.school.findUnique({
      where: { schoolId },
      select: { status: true },
    });
    if (!school) throw new NotFoundException('ไม่พบโรงเรียน');
    if (school.status !== Status.ACTIVE)
      throw new ConflictException('โรงเรียนนี้ยังไม่ได้รับการอนุมัติ');

    const code = await this.generateUniqueInviteCode();
    await this.prisma.school.update({
      where: { schoolId },
      data: { inviteCode: code },
    });
    return { inviteCode: formatInviteCode(code) };
  }

  // ---------------------------------------------------------------- school admin

  async getSchoolForSchoolAdmin(schoolId: string) {
    const school = await this.prisma.school.findUnique({
      where: { schoolId },
      select: {
        schoolId: true,
        name: true,
        email: true,
        profile: true,
        studentAmount: true,
        status: true,
        inviteCode: true,
        _count: { select: { canteens: true } },
      },
    });
    if (!school) throw new NotFoundException('ไม่พบโรงเรียน');

    const restaurantCount = await this.prisma.restaurant.count({
      where: { canteen: { schoolId }, status: { not: Status.REMOVED } },
    });
    const { _count, inviteCode, ...rest } = school;
    return {
      ...rest,
      inviteCode: inviteCode ? formatInviteCode(inviteCode) : null,
      canteenCount: _count.canteens,
      restaurantCount,
    };
  }

  /** Platform-level on/off switch. Only ACTIVE <-> SUSPENDED is allowed. */
  async setSchoolStatus(schoolId: string, status: 'ACTIVE' | 'SUSPENDED') {
    const school = await this.prisma.school.findUnique({
      where: { schoolId },
      select: { status: true },
    });
    if (!school) throw new NotFoundException('ไม่พบโรงเรียน');
    if (school.status !== Status.ACTIVE && school.status !== Status.SUSPENDED)
      throw new ConflictException('ไม่สามารถเปลี่ยนสถานะโรงเรียนนี้ได้');
    if (school.status !== status) {
      await this.prisma.school.update({
        where: { schoolId },
        data: { status },
      });
      invalidateRestaurantVisibility(); // every shop in the school changes visibility
    }
    return { schoolId, status, previous: school.status };
  }

  async updateSchool(schoolId: string, dto: UpdateSchoolDto) {
    const data: Prisma.SchoolUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.email !== undefined) data.email = dto.email.trim().toLowerCase();
    if (dto.profile !== undefined) data.profile = dto.profile;
    if (dto.studentAmount !== undefined) data.studentAmount = dto.studentAmount;

    try {
      return await this.prisma.school.update({
        where: { schoolId },
        data,
        select: {
          schoolId: true,
          name: true,
          email: true,
          profile: true,
          studentAmount: true,
          status: true,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025')
          throw new NotFoundException('ไม่พบโรงเรียน');
        if (error.code === 'P2002')
          throw new ConflictException('ชื่อหรืออีเมลของโรงเรียนนี้ถูกใช้แล้ว');
      }
      throw error;
    }
  }
}
