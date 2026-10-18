import { randomUUID } from 'crypto';
import {
  InviteCodeType, MembershipStatus, RefundReason, RestaurantRole, Role, SchoolRole, ComplaintTarget,
} from '@prisma/client';
import type { PrismaService } from '../../src/prisma/prisma.service';
import {
  makeCanteen, makeMenu, makeMember, makeRestaurant, makeSchool, makeUser,
} from './factories';

export const ACTORS = [
  'anon', 'noSchool', 'student', 'studentOther', 'pendingStaff', 'staff', 'restaurantAdmin', 'owner',
  'ownerOtherShop', 'schoolAdmin', 'schoolAdminOther', 'sysadmin', 'sysadminAal1',
] as const;
export type Actor = (typeof ACTORS)[number];

export interface RbacWorld {
  userIds: Record<Exclude<Actor, 'anon'>, string>;
  ids: Record<string, string>;
}

/** One school with a shop, plus every kind of actor around it and one fixture row for each id a route can take. */
export async function makeRbacWorld(
  prisma: PrismaService,
  orderState: 'received' | 'cooking' | 'ready' | 'done' = 'done',
): Promise<RbacWorld> {
  const school = await makeSchool(prisma);
  const school2 = await makeSchool(prisma);
  const canteen = await makeCanteen(prisma, school.schoolId);
  const canteen2 = await makeCanteen(prisma, school.schoolId);
  const restaurant = await makeRestaurant(prisma, canteen.canteenId, { autoAccept: false });
  const restaurant2 = await makeRestaurant(prisma, canteen2.canteenId);
  const menu = await makeMenu(prisma, restaurant.restaurantId);

  const noSchool = await makeUser(prisma);
  const student = await makeUser(prisma, { schoolId: school.schoolId });
  const studentOther = await makeUser(prisma, { schoolId: school2.schoolId });
  const pendingStaff = await makeUser(prisma, { schoolId: school.schoolId });
  const pending = await prisma.restaurantMembership.create({
    data: { userId: pendingStaff.userId, restaurantId: restaurant.restaurantId, role: RestaurantRole.STAFF, status: MembershipStatus.PENDING },
  });
  const staff = await makeMember(prisma, restaurant.restaurantId, RestaurantRole.STAFF, school.schoolId);
  const restaurantAdmin = await makeMember(prisma, restaurant.restaurantId, RestaurantRole.ADMIN, school.schoolId);
  const owner = await makeMember(prisma, restaurant.restaurantId, RestaurantRole.OWNER, school.schoolId);
  const ownerOtherShop = await makeMember(prisma, restaurant2.restaurantId, RestaurantRole.OWNER, school.schoolId);

  const mkAdmin = async (schoolId: string) => {
    const u = await makeUser(prisma, { schoolId });
    await prisma.schoolMembership.create({ data: { userId: u.userId, schoolId, role: SchoolRole.ADMIN, status: MembershipStatus.APPROVED } });
    return u;
  };
  const schoolAdmin = await mkAdmin(school.schoolId);
  const schoolAdminOther = await mkAdmin(school2.schoolId);
  const sysadmin = await makeUser(prisma, { role: Role.ADMIN, userId: `aal2-${randomUUID()}` });
  const sysadminAal1 = await makeUser(prisma, { role: Role.ADMIN });

  const order = await prisma.order.create({
    data: {
      restaurantId: restaurant.restaurantId, userId: student.userId, pickupAt: new Date(Date.now() + 3_600_000),
      totalAmount: 40,
      ...(orderState === 'received'
        ? { paymentStatus: 'UNPAID', status: 'receive', acceptAt: null }
        : { paymentStatus: 'PAID', paidAt: new Date(), acceptAt: new Date(), status: orderState === 'done' ? 'done' : orderState === 'ready' ? 'ready' : 'cooking' }),
      orderMenus: { create: [{ quantity: 1, menuName: menu.name, unitPrice: 40, totalPrice: 40, menuId: menu.menuId }] },
    },
  });
  const refund = await prisma.refundRequest.create({
    data: {
      orderId: order.orderId, userId: student.userId, restaurantId: restaurant.restaurantId, schoolId: school.schoolId,
      reason: RefundReason.OTHER, amount: 40, activeOrderId: order.orderId,
    },
  });
  const complaint = await prisma.complaint.create({
    data: { orderId: order.orderId, userId: student.userId, schoolId: school.schoolId, restaurantId: restaurant.restaurantId, target: ComplaintTarget.SCHOOL, message: 'x' },
  });
  const schoolCode = await prisma.inviteCode.create({
    data: { code: `S${randomUUID().slice(0, 7)}`, type: InviteCodeType.SCHOOL_ADMIN, schoolId: school.schoolId, maxUses: 1 },
  });
  const shopCode = await prisma.inviteCode.create({
    data: { code: `R${randomUUID().slice(0, 7)}`, type: InviteCodeType.SHOP_STAFF, schoolId: school.schoolId, restaurantId: restaurant.restaurantId, maxUses: 0 },
  });
  const pendingAdmin = await makeUser(prisma, { schoolId: school.schoolId });
  const schoolMember = await prisma.schoolMembership.create({
    data: { userId: pendingAdmin.userId, schoolId: school.schoolId, role: SchoolRole.ADMIN, status: MembershipStatus.PENDING },
  });

  return {
    userIds: {
      noSchool: noSchool.userId, student: student.userId, studentOther: studentOther.userId, pendingStaff: pendingStaff.userId,
      staff: staff.userId, restaurantAdmin: restaurantAdmin.userId, owner: owner.userId, ownerOtherShop: ownerOtherShop.userId,
      schoolAdmin: schoolAdmin.userId, schoolAdminOther: schoolAdminOther.userId, sysadmin: sysadmin.userId, sysadminAal1: sysadminAal1.userId,
    },
    ids: {
      schoolId: school.schoolId, restaurantId: restaurant.restaurantId, menuId: menu.menuId, orderId: order.orderId,
      canteenId: canteen.canteenId, userId: noSchool.userId, payoutId: randomUUID(),
      refundId: refund.id, complaintId: complaint.id, schoolCodeId: schoolCode.id, shopCodeId: shopCode.id,
      restaurantMemberId: pending.id, schoolMemberId: schoolMember.id, grantId: randomUUID(),
    },
  };
}
