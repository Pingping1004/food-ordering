import { ForbiddenException } from '@nestjs/common';
import { OrderController } from './order.controller';

describe('POST /order/create for a SUSPENDED school', () => {
  const make = (schoolStatus: string) => {
    const access: any = {
      assertRestaurantVisible: jest
        .fn()
        .mockResolvedValue({ status: 'ACTIVE', schoolId: 's1', schoolStatus }),
    };
    const orders: any = {
      createOrder: jest.fn().mockResolvedValue({ orderId: 'o1' }),
    };
    return { access, orders, ctl: new OrderController(orders, access) };
  };
  const req: any = { user: { userId: 'u1' } };

  it('is blocked with 403 SCHOOL_SUSPENDED', async () => {
    const { ctl, orders } = make('SUSPENDED');
    const err: any = await ctl
      .createOrder({ restaurantId: 'r1' } as any, req)
      .catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect(err.getResponse().code).toBe('SCHOOL_SUSPENDED');
    expect(orders.createOrder).not.toHaveBeenCalled();
  });

  it('an ACTIVE school still orders', async () => {
    const { ctl, orders } = make('ACTIVE');
    await ctl.createOrder({ restaurantId: 'r1' } as any, req);
    expect(orders.createOrder).toHaveBeenCalled();
  });
});
