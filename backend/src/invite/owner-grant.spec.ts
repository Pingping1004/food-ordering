import { ForbiddenException } from '@nestjs/common';
import { RestaurantService } from '../restaurant/restaurant.service';
import { consumeOwnerGrant } from './owner-grant';

const makePrisma = (grant: any) => {
  const prisma: any = {
    user: { findUnique: jest.fn().mockResolvedValue({ schoolId: 's1' }) },
    canteen: { findFirst: jest.fn().mockResolvedValue({ canteenId: 'c1' }) },
    restaurant: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest
        .fn()
        .mockResolvedValue({ restaurantId: 'r1', status: 'PENDING' }),
    },
    inviteRedemption: {
      findFirst: jest.fn().mockResolvedValue(grant),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  prisma.$transaction = jest.fn(async (cb: any) => cb(prisma));
  return prisma;
};

const build = (prisma: any) => {
  const upload = {
    saveImage: jest.fn().mockResolvedValue({ url: 'http://img' }),
  };
  const qr = {
    processPaymentQr: jest.fn().mockResolvedValue({
      accountNumber: '123',
      bankAccount: 'B',
      warnings: [],
    }),
  };
  return {
    svc: new RestaurantService(prisma, upload as any, {} as any, qr as any),
    upload,
  };
};

const dto: any = {
  name: 'Noodles',
  email: 'a@b.c',
  canteenId: 'c1',
  categories: [],
};
const file: any = { buffer: Buffer.from('x') };

describe('POST /restaurant needs a SHOP_OWNER grant', () => {
  it('403 without a grant, before anything is uploaded or created', async () => {
    const prisma = makePrisma(null);
    const { svc, upload } = build(prisma);
    await expect(svc.createRestaurant(dto, 'u1', file)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(upload.saveImage).not.toHaveBeenCalled();
    expect(prisma.restaurant.create).not.toHaveBeenCalled();
    expect(prisma.inviteRedemption.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'u1',
          consumedAt: null,
          code: { type: 'SHOP_OWNER', schoolId: 's1' },
        },
      }),
    );
  });

  it('consumes exactly one grant in the same transaction that creates the PENDING shop', async () => {
    const prisma = makePrisma({ id: 'red1' });
    const { svc } = build(prisma);
    const res = await svc.createRestaurant(dto, 'u1', file);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.inviteRedemption.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.inviteRedemption.updateMany).toHaveBeenCalledWith({
      where: { id: 'red1', consumedAt: null },
      data: { consumedAt: expect.any(Date) },
    });
    expect(prisma.restaurant.create.mock.calls[0][0].data).toMatchObject({
      status: 'PENDING',
      canteenId: 'c1',
    });
    expect(res.result.status).toBe('PENDING');
  });

  it('403 when the grant is consumed concurrently (compare-and-set loses) and no shop is created', async () => {
    const prisma = makePrisma({ id: 'red1' });
    prisma.inviteRedemption.updateMany.mockResolvedValue({ count: 0 });
    const { svc } = build(prisma);
    await expect(svc.createRestaurant(dto, 'u1', file)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.restaurant.create).not.toHaveBeenCalled();
  });

  it('consumeOwnerGrant with nothing left is 403', async () => {
    const prisma = makePrisma(null);
    await expect(consumeOwnerGrant(prisma, 'u1', 's1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
