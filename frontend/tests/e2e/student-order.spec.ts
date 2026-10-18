import { test, expect } from '@playwright/test';
import { API, acceptOrderInUi, apiGet, loginAndLand, newSession, placeOrder, seed } from './support/helpers';

const shop = seed.restaurants[0];

test.describe('Student orders, shop accepts, student is taken to payment', () => {
  test('student places an order and the shop acceptance moves them to the payment page', async ({ browser }) => {
    const studentCtx = await browser.newContext();
    const cookCtx = await browser.newContext();
    const student = await studentCtx.newPage();
    student.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 400)));
    await loginAndLand(student, seed.students[0], '**/user/restaurant');
    await expect(student.getByRole('link', { name: /Shop 0/ })).toBeVisible();

    const orderId = await placeOrder(student, 'Shop 0', ['Dish 0', 'Dish 1']);
    await expect(student.getByText('รอร้านรับออเดอร์')).toBeVisible();
    await expect(student.locator('body')).toContainText(/รวม\s*81\s*บาท/);

    // the order is real, belongs to this student, and is unpaid
    const mine = await apiGet(seed.students[0], `/order/${orderId}`);
    expect(mine.status).toBe(200);
    expect(mine.body.paymentStatus).toBe('UNPAID');
    expect(mine.body.totalAmount).toBe(81);

    // the shop sees it in its queue under the same short code and accepts it
    const cook = await newSession(cookCtx, shop.ownerId, `**/cooker/${shop.restaurantId}`);
    await acceptOrderInUi(cook, orderId);

    // the student's waiting screen follows automatically
    await student.waitForURL('**/user/order/payment/*', { timeout: 60_000 });
    await expect(student.locator('body')).toContainText('81');
    expect((await apiGet(seed.students[0], `/order/${orderId}`)).body.acceptAt).not.toBeNull();

    await studentCtx.close();
    await cookCtx.close();
  });

  test('a brief overload (503 + Retry-After) is retried by the app and still yields exactly one order', async ({ page }) => {
    const studentId = seed.students[1];
    await loginAndLand(page, studentId, '**/user/restaurant');

    let attempts = 0;
    await page.route('**/api/order/create', async (route) => {
      attempts += 1;
      if (attempts === 1) {
        return route.fulfill({ status: 503, headers: { 'retry-after': '1', 'content-type': 'application/json', 'access-control-allow-origin': 'http://localhost:3100' }, body: JSON.stringify({ statusCode: 503, message: 'busy' }) });
      }
      return route.continue();
    });

    const before = (await apiGet(studentId, '/order/mine')).body.length;
    const orderId = await placeOrder(page, 'Shop 1', ['Dish 2']);
    expect(attempts).toBe(2);
    await expect(page.getByText('รอร้านรับออเดอร์')).toBeVisible();
    const after = (await apiGet(studentId, '/order/mine')).body;
    expect(after.length).toBe(before + 1);
    expect(after.some((o: { orderId: string }) => o.orderId === orderId)).toBe(true);
  });

  test('double-clicking "confirm" never creates two orders', async ({ page }) => {
    const studentId = seed.students[2];
    await loginAndLand(page, studentId, '**/user/restaurant');
    const before = (await apiGet(studentId, '/order/mine')).body.length;

    await page.getByRole('button', { name: 'เข้าใจแล้ว' }).click({ timeout: 3000 }).catch(() => undefined);
    await page.getByRole('link', { name: /Shop 0/ }).first().click();
    await page.getByRole('button', { name: 'เพิ่ม Dish 3 ลงตะกร้า' }).click();
    await page.getByRole('button', { name: /ดูตะกร้า/ }).click();
    await page.waitForURL('**/user/order/confirm/*', { timeout: 20_000 });
    await page.getByRole('button', { name: 'ยืนยันออเดอร์' }).dblclick();
    await page.waitForURL('**/user/order/wait/*', { timeout: 20_000 });
    await page.waitForTimeout(1500);
    expect((await apiGet(studentId, '/order/mine')).body.length).toBe(before + 1);
  });
});

test.describe('Access gates in the browser', () => {
  test('anonymous visitors are sent to login; wrong password shows a clear Thai message', async ({ page }) => {
    await page.goto('/user/restaurant');
    await page.waitForURL('**/login**');
    await page.getByLabel('อีเมล').fill(`${seed.students[0]}@load.local`);
    await page.getByLabel('รหัสผ่าน').fill('not-the-password');
    await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
    await expect(page.getByText('อีเมลหรือรหัสผ่านไม่ถูกต้อง')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('a student cannot use the shop kitchen or the school admin screens', async ({ page }) => {
    await loginAndLand(page, seed.students[3], '**/user/restaurant');
    await page.goto(`/cooker/${shop.restaurantId}`);
    await page.waitForTimeout(2500);
    await expect(page.getByRole('button', { name: 'รับออเดอร์' })).toHaveCount(0);
    await page.goto(`/school/${seed.schoolId}`);
    await page.waitForTimeout(2500);
    await expect(page.getByText('ภาพรวมโรงอาหาร')).toHaveCount(0);
    // and the API says no on its own
    expect((await apiGet(seed.students[3], `/order/today/${shop.restaurantId}`)).status).toBe(403);
    expect((await apiGet(seed.students[3], `/schools/${seed.schoolId}/metrics/summary`)).status).toBe(403);
  });

  test("another shop's owner sees nothing of this shop's orders", async ({ page }) => {
    await loginAndLand(page, seed.restaurants[1].ownerId, `**/cooker/${seed.restaurants[1].restaurantId}`);
    expect((await apiGet(seed.restaurants[1].ownerId, `/order/today/${shop.restaurantId}`)).status).toBe(403);
  });
});

test('API is reachable from the browser origin (CORS) with the Idempotency-Key header', async ({ page, request }) => {
  const res = await request.fetch(`${API}/order/create`, {
    method: 'OPTIONS',
    headers: { Origin: 'http://localhost:3100', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,idempotency-key,content-type' },
  });
  expect(res.headers()['access-control-allow-origin']).toBe('http://localhost:3100');
  expect(res.headers()['access-control-allow-headers'].toLowerCase()).toContain('idempotency-key');
  void page;
});
