import { ConflictException, NotFoundException } from '@nestjs/common';
import { SchoolAdminService } from './school-admin.service';

const makePrisma = () => {
  const prisma: any = {
    schoolMembership: {
      findFirst: jest.fn(),
      count: jest.fn(),
      delete: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    user: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    restaurant: {
      findFirst: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    order: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  prisma.$transaction = jest.fn(async (cb: any) => cb(prisma));
  return prisma;
};

describe('SchoolAdminService members', () => {
  it('cannot remove the last approved school admin', async () => {
    const prisma = makePrisma();
    prisma.schoolMembership.findFirst.mockResolvedValue({
      id: 'm1',
      role: 'ADMIN',
      status: 'APPROVED',
      userId: 'u1',
    });
    prisma.schoolMembership.count.mockResolvedValue(1);

    await expect(
      new SchoolAdminService(prisma).removeMember('s1', 'm1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.schoolMembership.delete).not.toHaveBeenCalled();
  });

  it('can remove an admin when another approved admin remains', async () => {
    const prisma = makePrisma();
    prisma.schoolMembership.findFirst.mockResolvedValue({
      id: 'm1',
      role: 'ADMIN',
      status: 'APPROVED',
      userId: 'u1',
    });
    prisma.schoolMembership.count.mockResolvedValue(2);

    await expect(
      new SchoolAdminService(prisma).removeMember('s1', 'm1'),
    ).resolves.toEqual({ deleted: true });
    expect(prisma.schoolMembership.delete).toHaveBeenCalledWith({
      where: { id: 'm1' },
    });
  });

  it('removing a pending request or staff row never counts admins', async () => {
    const prisma = makePrisma();
    prisma.schoolMembership.findFirst.mockResolvedValue({
      id: 'm2',
      role: 'ADMIN',
      status: 'PENDING',
      userId: 'u2',
    });
    await new SchoolAdminService(prisma).removeMember('s1', 'm2');
    expect(prisma.schoolMembership.count).not.toHaveBeenCalled();
    expect(prisma.schoolMembership.delete).toHaveBeenCalled();
  });

  it('a member of another school is a 404 (lookup is scoped by schoolId)', async () => {
    const prisma = makePrisma();
    prisma.schoolMembership.findFirst.mockResolvedValue(null);
    await expect(
      new SchoolAdminService(prisma).removeMember('s1', 'foreign'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.schoolMembership.findFirst).toHaveBeenCalledWith({
      where: { id: 'foreign', schoolId: 's1' },
    });
  });

  it('approve sets the member school and only works on PENDING', async () => {
    const prisma = makePrisma();
    prisma.schoolMembership.findFirst.mockResolvedValue({
      id: 'm1',
      role: 'ADMIN',
      status: 'PENDING',
      userId: 'u1',
    });
    await new SchoolAdminService(prisma).approveMember('s1', 'm1');
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', schoolId: null },
      data: { schoolId: 's1' },
    });

    prisma.schoolMembership.findFirst.mockResolvedValue({
      id: 'm1',
      role: 'ADMIN',
      status: 'APPROVED',
      userId: 'u1',
    });
    await expect(
      new SchoolAdminService(prisma).approveMember('s1', 'm1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('SchoolAdminService restaurant status', () => {
  it('approves a PENDING shop and rejects illegal transitions', async () => {
    const prisma = makePrisma();
    const svc = new SchoolAdminService(prisma);

    prisma.restaurant.findFirst.mockResolvedValue({ status: 'PENDING' });
    await expect(
      svc.setRestaurantStatus('s1', 'r1', 'ACTIVE' as any),
    ).resolves.toEqual({ restaurantId: 'r1', status: 'ACTIVE' });

    prisma.restaurant.findFirst.mockResolvedValue({ status: 'PENDING' });
    await expect(
      svc.setRestaurantStatus('s1', 'r1', 'SUSPENDED' as any),
    ).rejects.toBeInstanceOf(ConflictException);

    prisma.restaurant.findFirst.mockResolvedValue({ status: 'REMOVED' });
    await expect(
      svc.setRestaurantStatus('s1', 'r1', 'ACTIVE' as any),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('a restaurant of another school is a 404', async () => {
    const prisma = makePrisma();
    prisma.restaurant.findFirst.mockResolvedValue(null);
    await expect(
      new SchoolAdminService(prisma).setRestaurantStatus(
        's1',
        'rX',
        'ACTIVE' as any,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.restaurant.findFirst.mock.calls[0][0].where).toEqual({
      restaurantId: 'rX',
      canteen: { schoolId: 's1' },
    });
  });
});

describe('SchoolAdminService getRestaurant', () => {
  it('returns restaurant details with mapped canteen and week stats', async () => {
    const prisma = makePrisma();
    const svc = new SchoolAdminService(prisma);

    prisma.restaurant.findFirst.mockResolvedValue({
      restaurantId: 'r1',
      name: 'Noodle Shop',
      status: 'PENDING',
      canteenId: 'c1',
      canteen: {
        canteenId: 'c1',
        name: 'Main Canteen',
        operatingHours: [
          { dayOfWeek: 'MONDAY', openMinute: 480, closeMinute: 960 },
        ],
      },
      operatingHours: [],
      contactName: 'Somchai',
      contactSurname: 'Jaidee',
      contactTel: '0812345678',
      contactEmail: 'somchai@example.com',
      bankType: 'SCB',
      accountNumber: '1234567890',
      accountName: 'Somchai J',
      paymentQr: 'https://example.com/qr.png',
      categories: ['Noodle'],
      memberships: [
        {
          role: 'OWNER',
          createdAt: new Date('2026-10-15T10:00:00Z'),
          user: { userId: 'u1', name: 'Somchai', email: 'somchai@example.com' },
        },
      ],
    });

    prisma.order.findMany.mockResolvedValue([
      { orderId: 'o1', status: 'done', isDelay: false },
      { orderId: 'o2', status: 'rejected', isDelay: true },
    ]);

    const result = await svc.getRestaurant('s1', 'r1');

    expect(result.restaurantId).toBe('r1');
    expect(result.canteenName).toBe('Main Canteen');
    expect(result.pendingApproval).toBe(true);
    expect(result.joinedAt).toBe('2026-10-15');
    expect(result.people).toEqual([
      { name: 'Somchai', role: 'OWNER' },
    ]);
    expect(result.hours).toEqual([
      { dayOfWeek: 'MONDAY', openMinute: 480, closeMinute: 960 },
    ]);
    expect(result.week).toEqual({
      orders: 2,
      medianAcceptSeconds: 45,
      delayRate: 50,
      rejectRate: 50,
    });
  });

  it('throws 404 when restaurant is not found or does not belong to school', async () => {
    const prisma = makePrisma();
    const svc = new SchoolAdminService(prisma);

    prisma.restaurant.findFirst.mockResolvedValue(null);

    await expect(svc.getRestaurant('s1', 'r_unknown')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('SchoolAdminService canteens', () => {
  it('creates canteen with status and operating hours', async () => {
    const prisma: any = {
      canteen: {
        create: jest.fn().mockResolvedValue({
          canteenId: 'c1',
          name: 'Canteen 1',
          profile: null,
          status: 'INACTIVE',
          schoolId: 's1',
        }),
      },
      canteenOperatingHour: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
    const svc = new SchoolAdminService(prisma);
    const res = await svc.createCanteen('s1', {
      name: '  Canteen 1  ',
      status: 'INACTIVE' as any,
      hours: [
        { dayOfWeek: 'MONDAY', openMinute: 420, closeMinute: 930 },
        { dayOfWeek: 'TUESDAY', openMinute: 420, closeMinute: 930 },
      ],
    });
    expect(res).toEqual({
      canteenId: 'c1',
      name: 'Canteen 1',
      profile: null,
      status: 'INACTIVE',
      schoolId: 's1',
    });
    expect(prisma.canteen.create).toHaveBeenCalledWith({
      data: {
        schoolId: 's1',
        name: 'Canteen 1',
        profile: null,
        status: 'INACTIVE',
      },
      select: expect.objectContaining({ canteenId: true, name: true }),
    });
    expect(prisma.canteenOperatingHour.createMany).toHaveBeenCalledWith({
      data: [
        { canteenId: 'c1', dayOfWeek: 'MONDAY', openMinute: 420, closeMinute: 930 },
        { canteenId: 'c1', dayOfWeek: 'TUESDAY', openMinute: 420, closeMinute: 930 },
      ],
    });
  });
});

