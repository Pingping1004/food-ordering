import * as fs from 'fs';
import * as path from 'path';
import type { Page, BrowserContext } from '@playwright/test';

export interface SeedData {
  schoolId: string;
  students: string[];
  restaurants: { restaurantId: string; ownerId: string; cookIds: string[]; menuIds: string[] }[];
  schoolAdminId: string;
  pending: { restaurantId: string; ownerId: string };
}
export const seed: SeedData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.data.json'), 'utf8'));
export const API = process.env.E2E_API_URL || 'http://127.0.0.1:4010/api';

/** Same JWT shape the fake Supabase hands out; the test API accepts it. */
export const tokenFor = (id: string) => {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: id, aud: 'authenticated', role: 'authenticated', aal: 'aal1', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
};

export async function apiGet<T = any>(userId: string, route: string): Promise<{ status: number; body: T }> {
  const res = await fetch(`${API}${route}`, { headers: { Authorization: `Bearer ${tokenFor(userId)}` } });
  return { status: res.status, body: (await res.json().catch(() => null)) as T };
}

export async function login(page: Page, userId: string, password = 'password123') {
  await page.goto('/login');
  await page.getByLabel('อีเมล').fill(`${userId}@load.local`);
  await page.getByLabel('รหัสผ่าน').fill(password);
  await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
}

export async function loginAndLand(page: Page, userId: string, landing: string) {
  await login(page, userId);
  await page.waitForURL(landing, { timeout: 30_000 });
}

export async function newSession(context: BrowserContext, userId: string, landing: string) {
  const page = await context.newPage();
  await loginAndLand(page, userId, landing);
  return page;
}

/** The short code shown to staff and students: first 4 hex chars of the order id. */
export const orderCode = (orderId: string) => orderId.replace(/-/g, '').slice(0, 4).toUpperCase();

export async function dismissLunchNotice(page: Page) {
  await page.getByRole('button', { name: 'เข้าใจแล้ว' }).click({ timeout: 3000 }).catch(() => undefined);
}

/** Student: open a shop, add the dishes, and submit the order from the confirm page. Returns the new order id. */
export async function placeOrder(page: Page, shopName: string, dishes: string[]) {
  await dismissLunchNotice(page);
  await page.getByRole('link', { name: new RegExp(shopName) }).first().click();
  await page.waitForURL('**/user/restaurant/*');
  for (const d of dishes) await page.getByRole('button', { name: `เพิ่ม ${d} ลงตะกร้า` }).click();
  await page.getByRole('button', { name: /ดูตะกร้า/ }).click();
  await page.waitForURL('**/user/order/confirm/*', { timeout: 20_000 });
  await page.getByRole('button', { name: 'ยืนยันออเดอร์' }).click();
  await page.waitForURL('**/user/order/wait/*', { timeout: 20_000 });
  return page.url().split('/').pop()!;
}

/**
 * Cook: press "รับออเดอร์" on the card of ONE order, found by its short code. The button is located by walking up
 * from the code label to the nearest container that holds exactly one accept button, so a busy queue (or a stray
 * order from an earlier test) can never make the test accept the wrong order.
 */
export async function acceptOrderInUi(cook: Page, orderId: string) {
  const label = cook.getByText(orderCode(orderId), { exact: true }).first();
  await label.waitFor({ timeout: 30_000 });
  const handle = await label.elementHandle();
  const button = await cook.evaluateHandle((el) => {
    let n: Element | null = el as Element;
    while (n) {
      const accept = [...n.querySelectorAll('button')].filter((b) => b.textContent?.trim() === 'รับออเดอร์');
      if (accept.length === 1) return accept[0];
      if (accept.length > 1) return null;
      n = n.parentElement;
    }
    return null;
  }, handle);
  const el = button.asElement();
  if (!el) throw new Error(`no unambiguous accept button for order ${orderCode(orderId)}`);
  await el.click();
}
