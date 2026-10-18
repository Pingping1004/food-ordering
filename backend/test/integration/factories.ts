import { randomUUID } from 'crypto';
import { MembershipStatus, Role, RestaurantRole, SchoolRole, Status } from '@prisma/client';
import type { PrismaService } from '../../src/prisma/prisma.service';

const uid = () => randomUUID().slice(0, 8);

export async function makeSchool(prisma: PrismaService, over: Partial<{ status: Status }> = {}) {
  const s = uid();
  return prisma.school.create({
    data: { name: `School ${s}`, email: `school-${s}@test.local`, studentAmount: 2500, status: over.status ?? Status.ACTIVE },
  });
}

export async function makeCanteen(prisma: PrismaService, schoolId: string) {
  return prisma.canteen.create({ data: { name: `Canteen ${uid()}`, status: Status.ACTIVE, schoolId } });
}

export async function makeUser(
  prisma: PrismaService,
  over: Partial<{ role: Role; schoolId: string | null; userId: string }> = {},
) {
  const s = uid();
  return prisma.user.create({
    data: {
      userId: over.userId ?? randomUUID(),
      name: `User ${s}`,
      email: `u-${s}@test.local`,
      role: over.role ?? Role.USER,
      schoolId: over.schoolId ?? null,
    },
  });
}

export async function makeSchoolAdmin(prisma: PrismaService, schoolId: string) {
  const u = await makeUser(prisma, { schoolId });
  await prisma.schoolMembership.create({
    data: { userId: u.userId, schoolId, role: SchoolRole.ADMIN, status: MembershipStatus.APPROVED },
  });
  return u;
}

export async function makeRestaurant(
  prisma: PrismaService,
  canteenId: string,
  over: Partial<{ status: Status; autoAccept: boolean }> = {},
) {
  const s = uid();
  return prisma.restaurant.create({
    data: {
      name: `Shop ${s}`,
      email: `shop-${s}@test.local`,
      status: over.status ?? Status.ACTIVE,
      isAutoAcceptedOrder: over.autoAccept ?? false,
      maxActiveOrders: 500,
      avgCookingTimeMins: 5,
      contactName: 'A',
      contactSurname: 'B',
      contactTel: '0800000000',
      contactEmail: `c-${s}@test.local`,
      bankType: 'PROMPTPAY',
      accountNumber: '0000000000',
      accountName: 'Test',
      paymentQr: 'qr',
      canteenId,
    },
  });
}

export async function makeMember(
  prisma: PrismaService,
  restaurantId: string,
  role: RestaurantRole,
  schoolId?: string,
  status: MembershipStatus = MembershipStatus.APPROVED,
) {
  const u = await makeUser(prisma, { schoolId: schoolId ?? null });
  await prisma.restaurantMembership.create({ data: { userId: u.userId, restaurantId, role, status } });
  return u;
}

export async function makeMenu(
  prisma: PrismaService,
  restaurantId: string,
  over: Partial<{ price: number; maxDaily: number; isAvailable: boolean }> = {},
) {
  return prisma.menu.create({
    data: {
      name: `Menu ${uid()}`,
      price: over.price ?? 40,
      maxDaily: over.maxDaily ?? 30,
      isAvailable: over.isAvailable ?? true,
      restaurantId,
    },
  });
}

/** A school with one canteen, one auto-accept shop with one menu, plus an enrolled student. */
export async function makeWorld(prisma: PrismaService, opts: { autoAccept?: boolean; maxDaily?: number } = {}) {
  const school = await makeSchool(prisma);
  const canteen = await makeCanteen(prisma, school.schoolId);
  const restaurant = await makeRestaurant(prisma, canteen.canteenId, { autoAccept: opts.autoAccept ?? true });
  const menu = await makeMenu(prisma, restaurant.restaurantId, { maxDaily: opts.maxDaily });
  const student = await makeUser(prisma, { schoolId: school.schoolId });
  const owner = await makeMember(prisma, restaurant.restaurantId, RestaurantRole.OWNER, school.schoolId);
  const admin = await makeSchoolAdmin(prisma, school.schoolId);
  return { school, canteen, restaurant, menu, student, owner, admin };
}

export const orderBody = (restaurantId: string, menuId: string, quantity = 1, minutesAhead = 90) => ({
  restaurantId,
  pickupAt: new Date(Date.now() + minutesAhead * 60_000).toISOString(),
  orderMenus: [{ menuId, menuName: 'x', quantity, unitPrice: 1 }],
});
