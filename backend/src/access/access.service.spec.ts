import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AccessService } from './access.service';

const makePrisma = (overrides: any = {}) => ({
  user: {
    findUnique: jest.fn().mockResolvedValue({
      role: 'USER',
      schoolId: 's1',
      schoolMemberships: [],
      restaurantMemberships: [],
    }),
  },
  restaurant: { findUnique: jest.fn() },
  menu: { findUnique: jest.fn() },
  order: { findUnique: jest.fn() },
  ...overrides,
});

const build = (prisma: any) => new AccessService(prisma);

describe('AccessService', () => {
  describe('getContext', () => {
    it('maps approved memberships and school', async () => {
      const prisma = makePrisma();
      prisma.user.findUnique.mockResolvedValue({
        role: 'USER',
        schoolId: 's1',
        schoolMemberships: [{ schoolId: 's1' }],
        restaurantMemberships: [{ restaurantId: 'r1', role: 'OWNER' }],
      });
      const ctx = await build(prisma).getContext({ userId: 'u1' });
      expect(ctx).toEqual({
        isSystemAdmin: false,
        schoolId: 's1',
        schoolAdminOf: ['s1'],
        restaurantRoles: new Map([['r1', 'OWNER']]),
      });
      const where = prisma.user.findUnique.mock.calls[0][0].select;
      expect(where.schoolMemberships.where.status).toBe('APPROVED');
      expect(where.restaurantMemberships.where.status).toBe('APPROVED');
    });

    it('ADMIN role with aal1 is not a system admin; aal2 is', async () => {
      const prisma = makePrisma();
      prisma.user.findUnique.mockResolvedValue({
        role: 'ADMIN',
        schoolId: null,
        schoolMemberships: [],
        restaurantMemberships: [],
      });
      const svc = build(prisma);
      expect(
        (await svc.getContext({ userId: 'a', aal: 'aal1' })).isSystemAdmin,
      ).toBe(false);
      expect(
        (await svc.getContext({ userId: 'a', aal: null })).isSystemAdmin,
      ).toBe(false);
      expect(
        (await svc.getContext({ userId: 'a', aal: 'aal2' })).isSystemAdmin,
      ).toBe(true);
    });

    it('aal2 without ADMIN role is not a system admin', async () => {
      const ctx = await build(makePrisma()).getContext({
        userId: 'u',
        aal: 'aal2',
      });
      expect(ctx.isSystemAdmin).toBe(false);
    });

    it('caches per request object', async () => {
      const prisma = makePrisma();
      const svc = build(prisma);
      const req = {};
      await svc.getContext({ userId: 'u' }, req);
      await svc.getContext({ userId: 'u' }, req);
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
      await svc.getContext({ userId: 'u' }, {});
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(2);
    });

    it('unknown user gets an empty context', async () => {
      const prisma = makePrisma();
      prisma.user.findUnique.mockResolvedValue(null);
      const ctx = await build(prisma).getContext({ userId: 'x', aal: 'aal2' });
      expect(ctx.isSystemAdmin).toBe(false);
      expect(ctx.schoolAdminOf).toEqual([]);
    });
  });

  describe('assertSchoolAdmin', () => {
    it('passes for admin of that school, fails for another', async () => {
      const prisma = makePrisma();
      prisma.user.findUnique.mockResolvedValue({
        role: 'USER',
        schoolId: 's1',
        schoolMemberships: [{ schoolId: 's1' }],
        restaurantMemberships: [],
      });
      const svc = build(prisma);
      await expect(
        svc.assertSchoolAdmin({ userId: 'u' }, 's1'),
      ).resolves.toBeDefined();
      await expect(
        svc.assertSchoolAdmin({ userId: 'u' }, 's2'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('system admin (aal2) passes everywhere', async () => {
      const prisma = makePrisma();
      prisma.user.findUnique.mockResolvedValue({
        role: 'ADMIN',
        schoolId: null,
        schoolMemberships: [],
        restaurantMemberships: [],
      });
      await expect(
        build(prisma).assertSchoolAdmin({ userId: 'a', aal: 'aal2' }, 'any'),
      ).resolves.toBeDefined();
      await expect(
        build(prisma).assertSchoolAdmin({ userId: 'a', aal: 'aal1' }, 'any'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('assertRestaurantRole', () => {
    const withMembership = (
      role: string | null,
      schoolAdminOf: string[] = [],
    ) => {
      const prisma = makePrisma();
      prisma.user.findUnique.mockResolvedValue({
        role: 'USER',
        schoolId: 's1',
        schoolMemberships: schoolAdminOf.map((schoolId) => ({ schoolId })),
        restaurantMemberships: role ? [{ restaurantId: 'r1', role }] : [],
      });
      return prisma;
    };

    it('passes when role is allowed', async () => {
      const svc = build(withMembership('OWNER'));
      await expect(
        svc.assertRestaurantRole({ userId: 'u' }, 'r1', ['OWNER']),
      ).resolves.toBeDefined();
    });

    it('rejects a role that is not allowed (STAFF on owner-only)', async () => {
      const svc = build(withMembership('STAFF'));
      await expect(
        svc.assertRestaurantRole({ userId: 'u' }, 'r1', ['OWNER']),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects non-members and other restaurants', async () => {
      await expect(
        build(withMembership(null)).assertRestaurantRole(
          { userId: 'u' },
          'r1',
          ['OWNER', 'STAFF'],
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        build(withMembership('OWNER')).assertRestaurantRole(
          { userId: 'u' },
          'r2',
          ['OWNER'],
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('school admin passes only with allowSchoolAdmin and for their own school', async () => {
      const prisma = withMembership(null, ['s1']);
      prisma.restaurant.findUnique.mockResolvedValue({
        canteen: { schoolId: 's1' },
      });
      const svc = build(prisma);
      await expect(
        svc.assertRestaurantRole({ userId: 'u' }, 'r1', ['OWNER']),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        svc.assertRestaurantRole({ userId: 'u' }, 'r1', ['OWNER'], {
          allowSchoolAdmin: true,
        }),
      ).resolves.toBeDefined();

      prisma.restaurant.findUnique.mockResolvedValue({
        canteen: { schoolId: 'other' },
      });
      await expect(
        svc.assertRestaurantRole({ userId: 'u' }, 'r1', ['OWNER'], {
          allowSchoolAdmin: true,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('system admin with aal2 always passes, aal1 does not', async () => {
      const prisma = makePrisma();
      prisma.user.findUnique.mockResolvedValue({
        role: 'ADMIN',
        schoolId: null,
        schoolMemberships: [],
        restaurantMemberships: [],
      });
      const svc = build(prisma);
      await expect(
        svc.assertRestaurantRole({ userId: 'a', aal: 'aal2' }, 'r1', ['OWNER']),
      ).resolves.toBeDefined();
      await expect(
        svc.assertRestaurantRole({ userId: 'a', aal: 'aal1' }, 'r1', ['OWNER']),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('resolveRestaurantId', () => {
    it('resolves from restaurant, menu and order', async () => {
      const prisma = makePrisma();
      prisma.restaurant.findUnique.mockResolvedValue({ restaurantId: 'r1' });
      prisma.menu.findUnique.mockResolvedValue({ restaurantId: 'r2' });
      prisma.order.findUnique.mockResolvedValue({ restaurantId: 'r3' });
      const svc = build(prisma);
      expect(await svc.resolveRestaurantId({ restaurantId: 'r1' })).toBe('r1');
      expect(await svc.resolveRestaurantId({ menuId: 'm' })).toBe('r2');
      expect(await svc.resolveRestaurantId({ orderId: 'o' })).toBe('r3');
    });

    it('404 when missing or no ref', async () => {
      const prisma = makePrisma();
      prisma.menu.findUnique.mockResolvedValue(null);
      const svc = build(prisma);
      await expect(
        svc.resolveRestaurantId({ menuId: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(svc.resolveRestaurantId({})).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
