import { test, expect, type Browser, type Request } from '@playwright/test';
import { API, loginAndLand, placeOrder, seed, tokenFor } from './support/helpers';

const shop = seed.restaurants[0];

test.describe('Student screens poll the light status route', () => {
  test('the wait screen polls /status at the server pace and reloads the full order only when it changes', async ({ page }) => {
    const studentId = seed.students[5];
    await loginAndLand(page, studentId, '**/user/restaurant');
    const orderId = await placeOrder(page, 'Shop 0', ['Dish 0']);

    const statusPolls: Request[] = [];
    const fullLoads: Request[] = [];
    page.on('request', (r) => {
      if (r.method() !== 'GET') return;
      const path = new URL(r.url()).pathname;
      if (path === `/api/order/${orderId}/status`) statusPolls.push(r);
      if (path === `/api/order/${orderId}`) fullLoads.push(r);
    });

    // waiting for the shop: X-Poll-After 5 s ±20 % → about 2–3 status checks in 13 s, and no full reloads
    await page.waitForTimeout(13_000);
    expect(statusPolls.length).toBeGreaterThanOrEqual(2);
    expect(statusPolls.length).toBeLessThanOrEqual(4);
    expect(fullLoads.length).toBe(0);
    const res = await statusPolls[0].response();
    expect(res?.headers()['x-poll-after']).toBe('5');
    expect(res?.headers()['access-control-expose-headers']?.toLowerCase()).toContain('x-poll-after'); // readable cross-origin

    // the shop accepts: the next status check sees it, the full order is loaded once, and the student moves on
    const accepted = await fetch(`${API}/order/accept/${orderId}`, { method: 'PATCH', headers: { Authorization: `Bearer ${tokenFor(shop.ownerId)}` } });
    expect(accepted.status).toBe(200);
    await page.waitForURL('**/user/order/payment/*', { timeout: 15_000 });
    expect(fullLoads.length).toBeGreaterThanOrEqual(1);
  });
});

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const LINE_UA = `${IPHONE_UA} Line/14.10.0`;

async function phone(browser: Browser, userAgent: string) {
  const ctx = await browser.newContext({ userAgent, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  return { ctx, page: await ctx.newPage() };
}

test.describe('"Install Promptserve" banner', () => {
  test('a student on an iPhone sees it, can read both guides, and "later" hides it', async ({ browser }) => {
    const { ctx, page } = await phone(browser, IPHONE_UA);
    await loginAndLand(page, seed.students[6], '**/user/restaurant');

    const banner = page.getByRole('region', { name: 'ติดตั้งแอป Promptserve' });
    await expect(banner).toBeVisible();
    await banner.getByRole('button', { name: 'ดูวิธีติดตั้ง' }).click();

    const guide = page.getByRole('dialog', { name: 'วิธีติดตั้ง Promptserve' });
    await expect(guide.getByRole('tab', { name: 'iPhone / iPad' })).toHaveAttribute('aria-selected', 'true');
    await expect(guide.getByText('เพิ่มไปยังหน้าจอโฮม').first()).toBeVisible();
    await guide.getByRole('tab', { name: 'Android' }).click();
    await expect(guide.getByText('ติดตั้งแอป').first()).toBeVisible();
    await guide.getByRole('button', { name: 'เข้าใจแล้ว' }).click();
    await expect(guide).toBeHidden();

    await banner.getByRole('button', { name: 'ไว้ทีหลัง' }).click();
    await expect(banner).toBeHidden();
    await page.reload();
    await expect(page.getByRole('link', { name: /Shop 0/ })).toBeVisible();
    await expect(page.getByRole('region', { name: 'ติดตั้งแอป Promptserve' })).toBeHidden();
    await ctx.close();
  });

  test('shop staff and school admins see it too; inside LINE it offers to open the real browser', async ({ browser }) => {
    const cook = await phone(browser, IPHONE_UA);
    await loginAndLand(cook.page, shop.ownerId, `**/cooker/${shop.restaurantId}`);
    await expect(cook.page.getByRole('region', { name: 'ติดตั้งแอป Promptserve' })).toBeVisible();
    await cook.ctx.close();

    const admin = await phone(browser, LINE_UA);
    await loginAndLand(admin.page, seed.schoolAdminId, `**/school/${seed.schoolId}**`);
    await admin.page.getByRole('region', { name: 'ติดตั้งแอป Promptserve' }).getByRole('button', { name: 'ดูวิธีติดตั้ง' }).click();
    const open = admin.page.getByRole('link', { name: 'เปิดใน Safari / Chrome' });
    await expect(open).toHaveAttribute('href', /openExternalBrowser=1/);
    await admin.ctx.close();
  });

  test('nobody sees it on a computer', async ({ page }) => {
    await loginAndLand(page, seed.students[7], '**/user/restaurant');
    await expect(page.getByRole('link', { name: /Shop 0/ })).toBeVisible();
    await expect(page.getByRole('region', { name: 'ติดตั้งแอป Promptserve' })).toHaveCount(0);
  });
});
