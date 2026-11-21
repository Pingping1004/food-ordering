import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { assertDishLimit, MAX_DISHES_PER_ORDER } from './order-limits';
import { OrderService } from './order.service';
import { CreateOrderMenusDto } from './dto/create-order.dto';

const line = (quantity: number) => ({ quantity });

describe('max dishes per order', () => {
  it('is 5', () => {
    expect(MAX_DISHES_PER_ORDER).toBe(5);
  });

  it('allows up to 5 dishes in total, however they are split', () => {
    expect(() => assertDishLimit([line(5)])).not.toThrow();
    expect(() => assertDishLimit([line(2), line(2), line(1)])).not.toThrow();
    expect(() => assertDishLimit([1, 1, 1, 1, 1].map(line))).not.toThrow();
  });

  it('rejects 6 or more with 400 ORDER_TOO_MANY_DISHES and a Thai message', () => {
    for (const menus of [
      [line(6)],
      [line(3), line(3)],
      [1, 1, 1, 1, 1, 1].map(line),
      [line(50)],
    ]) {
      const err: any = (() => {
        try {
          assertDishLimit(menus);
        } catch (e) {
          return e;
        }
      })();
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.getResponse()).toEqual({
        message: 'สั่งได้สูงสุด 5 จานต่อออเดอร์',
        code: 'ORDER_TOO_MANY_DISHES',
      });
    }
  });

  it('createOrder refuses before checking the queue, the menus or the stock', async () => {
    const svc = Object.create(OrderService.prototype) as any;
    svc.validateTimingAndQueue = jest.fn();
    svc.validateOrderMenus = jest.fn();
    await expect(
      svc.createOrder(
        { restaurantId: 'r1', orderMenus: [{ menuId: 'm1', quantity: 6 }] },
        'u1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(svc.validateTimingAndQueue).not.toHaveBeenCalled();
    expect(svc.validateOrderMenus).not.toHaveBeenCalled();
  });

  it('quantity must be a whole number of at least 1 (2.5 cannot slip under the limit)', async () => {
    const dto = (quantity: unknown) =>
      plainToInstance(CreateOrderMenusDto, {
        menuId: '6f1c2a54-1b7e-4d1a-9a3e-2f6c1d4b8e90',
        menuName: 'x',
        unitPrice: 40,
        quantity,
      });
    expect(await validate(dto(2))).toHaveLength(0);
    expect((await validate(dto(2.5))).length).toBeGreaterThan(0);
    expect((await validate(dto(0))).length).toBeGreaterThan(0);
  });
});
