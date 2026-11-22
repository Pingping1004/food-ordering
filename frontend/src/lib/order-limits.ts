/** Dishes per order, counted by quantity (2 × กะเพรา + 1 × น้ำ = 3). The API enforces the same number (backend/src/order/order-limits.ts). */
export const MAX_DISHES_PER_ORDER = 5;

export const TOO_MANY_DISHES_MESSAGE = `สั่งได้สูงสุด ${MAX_DISHES_PER_ORDER} จานต่อออเดอร์`;

export const totalDishes = (items: ReadonlyArray<{ quantity: number }>): number => items.reduce((n, i) => n + i.quantity, 0);

export const canAddDish = (items: ReadonlyArray<{ quantity: number }>): boolean => totalDishes(items) < MAX_DISHES_PER_ORDER;
