import { ConflictException, NotFoundException } from '@nestjs/common';
import { RestaurantService } from './restaurant.service';

const makePrisma = () => ({
  user: { findUnique: jest.fn() },
  restaurant: { findUnique: jest.fn() },
  restaurantMembership: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    delete: jest.fn().mockResolvedValue({}),
  },
});

const build = (prisma: any) =>
  new RestaurantService(prisma, {} as any, {} as any, {} as any);

describe('RestaurantService member approval (join-request endpoint is gone)', () => {
  it('no longer exposes requestToJoin', () => {
    expect((build(makePrisma()) as any).requestToJoin).toBeUndefined();
  });

  it('owner approves a PENDING request (compare-and-set on status)', async () => {
    const prisma = makePrisma();
    prisma.restaurantMembership.findFirst.mockResolvedValue({
      id: 'm1',
      userId: 'u2',
      role: 'STAFF',
      status: 'PENDING',
    });

    const res = await build(prisma).decideMember('r1', 'm1', 'approve');
    expect(prisma.restaurantMembership.findFirst).toHaveBeenCalledWith({
      where: { id: 'm1', restaurantId: 'r1' },
    });
    expect(prisma.restaurantMembership.updateMany).toHaveBeenCalledWith({
      where: { id: 'm1', status: 'PENDING' },
      data: { status: 'APPROVED' },
    });
    expect(res.status).toBe('APPROVED');
  });

  it('reject works, a decided request or foreign member id fails', async () => {
    const prisma = makePrisma();
    prisma.restaurantMembership.findFirst.mockResolvedValue({
      id: 'm1',
      userId: 'u2',
      role: 'STAFF',
      status: 'PENDING',
    });
    await expect(
      build(prisma).decideMember('r1', 'm1', 'reject'),
    ).resolves.toMatchObject({ status: 'REJECTED' });

    prisma.restaurantMembership.findFirst.mockResolvedValue({
      id: 'm1',
      userId: 'u2',
      role: 'STAFF',
      status: 'APPROVED',
    });
    await expect(
      build(prisma).decideMember('r1', 'm1', 'approve'),
    ).rejects.toBeInstanceOf(ConflictException);

    prisma.restaurantMembership.findFirst.mockResolvedValue(null);
    await expect(
      build(prisma).decideMember('r1', 'other-restaurants-member', 'approve'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('the owner membership cannot be removed; staff can', async () => {
    const prisma = makePrisma();
    prisma.restaurantMembership.findFirst.mockResolvedValue({
      id: 'm1',
      role: 'OWNER',
      status: 'APPROVED',
    });
    await expect(build(prisma).removeMember('r1', 'm1')).rejects.toBeInstanceOf(
      ConflictException,
    );

    prisma.restaurantMembership.findFirst.mockResolvedValue({
      id: 'm2',
      role: 'STAFF',
      status: 'APPROVED',
    });
    await expect(build(prisma).removeMember('r1', 'm2')).resolves.toEqual({
      deleted: true,
    });
  });
});
