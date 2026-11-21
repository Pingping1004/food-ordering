import { BadRequestException } from '@nestjs/common';

/** Dishes per order, counted by quantity (2 × กะเพรา + 1 × น้ำ = 3). Keep in sync with frontend/src/lib/order-limits.ts. */
export const MAX_DISHES_PER_ORDER = 5;

export const TOO_MANY_DISHES_MESSAGE = `สั่งได้สูงสุด ${MAX_DISHES_PER_ORDER} จานต่อออเดอร์`;

/** Throws 400 `ORDER_TOO_MANY_DISHES` when the order holds more dishes than one student may order at once. */
export function assertDishLimit(
  orderMenus: ReadonlyArray<{ quantity: number }>,
): void {
  const dishes = orderMenus.reduce((n, m) => n + m.quantity, 0);
  if (dishes > MAX_DISHES_PER_ORDER)
    throw new BadRequestException({
      message: TOO_MANY_DISHES_MESSAGE,
      code: 'ORDER_TOO_MANY_DISHES',
    });
}
