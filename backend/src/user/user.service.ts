import {
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';
import {
  InviteCodeType,
  MembershipStatus,
  Role,
  RestaurantRole,
  SchoolRole,
  Status,
} from '@prisma/client';
import { RestaurantService } from 'src/restaurant/restaurant.service';
import { SupabaseService } from 'src/supabase/supabase.service';

export interface UserProfile {
  userId: string;
  email: string | null;
  name: string;
  role: Role;
  /** True when the token is aal2 (TOTP verified). */
  mfaVerified: boolean;
  /** True while the user holds an unconsumed SHOP_OWNER invite redemption (may POST /restaurant). */
  pendingOwnerGrant: boolean;
  /** Own school (never contains the invite code). */
  school: { schoolId: string; name: string } | null;
  schoolMemberships: {
    schoolId: string;
    schoolName: string;
    schoolStatus: Status;
    role: SchoolRole;
    status: MembershipStatus;
  }[];
  /** Sysadmin only: the caller's latest active break-glass grant. */
  supportGrant: { schoolId: string; expiresAt: Date; reason: string } | null;
  restaurantMemberships: {
    restaurantId: string;
    restaurantName: string;
    role: RestaurantRole;
    status: MembershipStatus;
    restaurantStatus: Status;
    canteenName: string;
  }[];
}

export type DeleteAccountBlocker =
  | { code: 'OWNS_RESTAURANT'; restaurantId: string; name: string }
  | { code: 'LAST_SCHOOL_ADMIN'; schoolId: string; name: string };

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => RestaurantService))
    private readonly restaurantService: RestaurantService,
    private readonly supabase: SupabaseService,
  ) {}

  async findAllUsers() {
    return await this.prisma.user.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOneByEmail(email: string) {
    const user = await this.prisma.safeRead(() =>
      this.prisma.user.findUnique({
        where: { email },
      }),
    );

    return user;
  }

  async findOneUser(userId: string, aal?: string | null): Promise<UserProfile> {
    const user = await this.prisma.safeRead(() =>
      this.prisma.user.findUnique({
        where: { userId },
        select: {
          userId: true,
          email: true,
          name: true,
          role: true,
          school: { select: { schoolId: true, name: true } },
          inviteRedemptions: {
            where: {
              consumedAt: null,
              code: { type: InviteCodeType.SHOP_OWNER },
            },
            select: { id: true },
            take: 1,
          },
          restaurantMemberships: {
            select: {
              role: true,
              status: true,
              restaurantId: true,
              restaurant: {
                select: {
                  name: true,
                  status: true,
                  canteen: { select: { name: true } },
                },
              },
            },
          },
          schoolMemberships: {
            select: {
              role: true,
              status: true,
              schoolId: true,
              school: { select: { name: true, status: true } },
            },
          },
        },
      }),
    );

    if (!user) {
      throw new NotFoundException(`ไม่พบผู้ใช้งานไอดี: ${userId}`);
    }

    // Only the caller's own profile (aal passed) and only for sysadmins.
    let supportGrant: UserProfile['supportGrant'] = null;
    if (user.role === Role.ADMIN && aal === 'aal2') {
      const grant = await this.prisma.supportGrant.findFirst({
        where: { adminId: userId, revokedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
        select: { schoolId: true, expiresAt: true, reason: true },
      });
      supportGrant = grant ?? null;
    }

    return {
      userId: user.userId,
      email: user.email,
      name: user.name,
      role: user.role,
      mfaVerified: aal === 'aal2',
      supportGrant,
      pendingOwnerGrant: user.inviteRedemptions.length > 0,
      school: user.school
        ? { schoolId: user.school.schoolId, name: user.school.name }
        : null,
      schoolMemberships: user.schoolMemberships.map((m) => ({
        schoolId: m.schoolId,
        schoolName: m.school.name,
        schoolStatus: m.school.status,
        role: m.role,
        status: m.status,
      })),
      restaurantMemberships: user.restaurantMemberships.map((m) => ({
        restaurantId: m.restaurantId,
        restaurantName: m.restaurant.name,
        role: m.role,
        status: m.status,
        restaurantStatus: m.restaurant.status,
        canteenName: m.restaurant.canteen.name,
      })),
    };
  }

  async updateUser(userId: string, updateUserDto: UpdateUserDto) {
    const updatedUser = await this.prisma.user.update({
      where: { userId },
      data: updateUserDto,
    });

    return updatedUser;
  }

  /** What prevents the caller from deleting their own account. Empty = free to delete. */
  async findDeleteBlockers(userId: string): Promise<DeleteAccountBlocker[]> {
    const [owned, adminOf] = await Promise.all([
      this.prisma.restaurantMembership.findMany({
        where: {
          userId,
          role: RestaurantRole.OWNER,
          restaurant: { status: { not: Status.REMOVED } },
        },
        select: { restaurantId: true, restaurant: { select: { name: true } } },
      }),
      this.prisma.schoolMembership.findMany({
        where: {
          userId,
          role: SchoolRole.ADMIN,
          status: MembershipStatus.APPROVED,
          school: { status: Status.ACTIVE },
        },
        select: { schoolId: true, school: { select: { name: true } } },
      }),
    ]);

    const blockers: DeleteAccountBlocker[] = owned.map((m) => ({
      code: 'OWNS_RESTAURANT',
      restaurantId: m.restaurantId,
      name: m.restaurant.name,
    }));

    for (const m of adminOf) {
      const admins = await this.prisma.schoolMembership.count({
        where: {
          schoolId: m.schoolId,
          role: SchoolRole.ADMIN,
          status: MembershipStatus.APPROVED,
        },
      });
      if (admins <= 1)
        blockers.push({
          code: 'LAST_SCHOOL_ADMIN',
          schoolId: m.schoolId,
          name: m.school.name,
        });
    }
    return blockers;
  }

  /**
   * DELETE /user/me. Blocked (409) while the caller owns a live shop or is the last admin of an ACTIVE school.
   * Memberships cascade, orders keep their rows with `userId = null`; the Supabase login is removed last
   * and a missing service-role key aborts *before* anything is deleted.
   */
  async deleteMyAccount(userId: string) {
    const blockers = await this.findDeleteBlockers(userId);
    if (blockers.length > 0) {
      throw new ConflictException({
        message: 'ไม่สามารถลบบัญชีได้ กรุณาจัดการรายการต่อไปนี้ก่อน',
        blockers,
      });
    }

    this.supabase.assertCanDeleteAuthUsers();

    await this.prisma.$transaction(async (tx) => {
      await tx.user.delete({ where: { userId } });
    });

    await this.supabase.deleteAuthUser(userId);
    return { deleted: true };
  }

  async removeUser(userId: string) {
    const user = await this.prisma.user.delete({
      where: { userId },
    });
    // the login lives in Supabase Auth – remove it too so the e-mail can be reused
    await this.supabase.deleteAuthUser(userId);

    return user;
  }
}
