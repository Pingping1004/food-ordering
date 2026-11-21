import { test, expect } from '@playwright/test';
import { apiGet, dismissLunchNotice, loginAndLand, seed } from './support/helpers';

test.describe('Max 5 dishes per order', () => {
  test('the cart stops at 5 dishes, says why, and a 5-dish order still goes through', async ({ page }) => {
    const studentId = seed.students[9]; // not used by any other spec
    await loginAndLand(page, studentId, '**/user/restaurant');
    const before = (await apiGet(studentId, '/order/mine')).body.length;

    await dismissLunchNotice(page);
    await page.getByRole('link', { name: /Shop 0/ }).first().click();
    await page.waitForURL('**/user/restaurant/*');

    // 2 + 2 + 1 = 5 dishes
    await page.getByRole('button', { name: 'เพิ่ม Dish 0 ลงตะกร้า' }).click();
    await page.getByRole('button', { name: 'เพิ่มจำนวน Dish 0' }).click();
    await page.getByRole('button', { name: 'เพิ่ม Dish 1 ลงตะกร้า' }).click();
    await page.getByRole('button', { name: 'เพิ่มจำนวน Dish 1' }).click();
    await page.getByRole('button', { name: 'เพิ่ม Dish 2 ลงตะกร้า' }).click();
    const cartButton = page.getByRole('button', { name: /ดูตะกร้า/ });
    await expect(cartButton).toContainText('5');

    // a 6th dish is refused with the Thai reason, and nothing changes
    const more = page.getByRole('button', { name: 'เพิ่มจำนวน Dish 0' });
    await expect(more).toHaveAttribute('aria-disabled', 'true');
    await more.click({ force: true }); // aria-disabled, but a tap still explains why
    await expect(page.getByText('สั่งได้สูงสุด 5 จานต่อออเดอร์').first()).toBeVisible();
    await page.getByRole('button', { name: 'เพิ่ม Dish 3 ลงตะกร้า' }).click({ force: true });
    await expect(cartButton).toContainText('5');

    // the cart page says it too, and the 5-dish order is accepted by the API
    await cartButton.click();
    await page.waitForURL('**/user/order/confirm/*', { timeout: 20_000 });
    await expect(page.getByText('สั่งได้สูงสุด 5 จานต่อออเดอร์').first()).toBeVisible();
    await page.getByRole('button', { name: 'ยืนยันออเดอร์' }).click();
    await page.waitForURL('**/user/order/wait/*', { timeout: 20_000 });
    const orderId = page.url().split('/').pop()!;
    const order = await apiGet(studentId, `/order/${orderId}`);
    expect(order.body.orderMenus.reduce((n: number, m: { quantity: number }) => n + m.quantity, 0)).toBe(5);
    expect((await apiGet(studentId, '/order/mine')).body.length).toBe(before + 1);
  });
});
