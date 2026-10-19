import { execFileSync } from 'child_process';
import { test, expect, type Page } from '@playwright/test';
import { API, seed, tokenFor, loginAndLand, placeOrder, dismissLunchNotice } from './support/helpers';

/**
 * Every page, at phone → external-monitor widths: the page body must never scroll sideways and nothing visible may
 * stick out past the screen edge. CI checks four widths; RESPONSIVE_FULL=1 checks all of them and
 * RESPONSIVE_SHOTS=<dir> also saves a full-page screenshot of each for a visual pass.
 */
const ALL = [
  { name: 'phone-s', width: 360, height: 740 },
  { name: 'iphone', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'ipad-air', width: 820, height: 1180 },
  { name: 'ipad-pro', width: 1024, height: 1366 },
  { name: 'ipad-land', width: 1366, height: 1024 },
  { name: 'laptop', width: 1440, height: 900 },
  { name: 'pc', width: 1920, height: 1080 },
  { name: 'monitor', width: 2560, height: 1440 },
];
const VIEWPORTS = process.env.RESPONSIVE_FULL ? ALL : ALL.filter((v) => ['phone-s', 'tablet', 'ipad-pro', 'pc'].includes(v.name));
const SHOTS = process.env.RESPONSIVE_SHOTS;

/** Visible elements that reach past the viewport and are not clipped by a scrolling/hidden ancestor. */
async function overflow(page: Page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const clipped = (el: Element) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if (ox !== 'visible') return true;
      }
      return false;
    };
    const out: string[] = [];
    for (const el of document.body.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.position === 'fixed' && r.right <= 0) continue;
      if ((r.right > vw + 1 || r.left < -1) && !clipped(el)) {
        const name = `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${String(el.getAttribute('class') ?? '').split(/\s+/).slice(0, 4).join('.')}`;
        out.push(`${name} [${Math.round(r.left)}→${Math.round(r.right)} of ${vw}] "${(el.textContent ?? '').trim().slice(0, 40)}"`);
      }
    }
    return { docWidth: document.documentElement.scrollWidth, vw, offenders: out.slice(0, 8) };
  });
}

async function audit(session: Page, label: string, path: string) {
  const problems: string[] = [];
  // A fresh tab per page: ~50 loads in one tab (kitchen polling, alert audio) slowly wedged the browser on a busy machine.
  const page = await session.context().newPage();
  try {
    await auditIn(page, label, path, problems);
  } finally {
    await page.close().catch(() => undefined);
  }
  return problems;
}

async function auditIn(page: Page, label: string, path: string, problems: string[]) {
  for (const v of VIEWPORTS) {
    await page.setViewportSize({ width: v.width, height: v.height });
    try {
      await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    } catch {
      problems.push(`${v.name} ${v.width}px: page did not load`);
      continue;
    }
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
    await dismissLunchNotice(page);
    await page.waitForTimeout(300);
    const r = await overflow(page);
    if (r.docWidth > r.vw + 1 || r.offenders.length) problems.push(`${v.name} ${v.width}px: page ${r.docWidth}px wide\n      ${r.offenders.join('\n      ')}`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${label}--${v.name}.png`, fullPage: true });
  }
}

const ONLY = process.env.RESPONSIVE_ONLY ? new RegExp(process.env.RESPONSIVE_ONLY) : null;

async function run(page: Page, pages: [string, string][]) {
  const failures: string[] = [];
  for (const [label, path] of pages) {
    if (ONLY && !ONLY.test(label)) continue;
    const p = await audit(page, label, path);
    if (p.length) failures.push(`${label} (${path})\n    ${p.join('\n    ')}`);
  }
  expect.soft(failures, failures.join('\n\n')).toEqual([]);
}

const shop = seed.restaurants[0];
const school = `/school/${seed.schoolId}`;

test.describe('responsive layout', () => {
  test.describe.configure({ timeout: 30 * 60_000 });

  test('public and auth pages', async ({ page }) => {
    await run(page, [
      ['landing', '/'],
      ['login', '/login'],
      ['signup', '/signup'],
      ['forgot-password', '/forgot-password'],
      ['reset-password', '/reset-password'],
    ]);
  });

  test('student pages', async ({ page }) => {
    const student = seed.students[8];
    await loginAndLand(page, student, '**/user/restaurant');
    const orderId = await placeOrder(page, 'Shop 1', ['Dish 1', 'Dish 2']);
    // Order screens first: an unaccepted order expires, and an accepted one only stays payable for a few minutes.
    await run(page, [['student-wait', `/user/order/wait/${orderId}`]]);
    // "Shop 1" is seed.restaurants[1]
    const accepted = await fetch(`${API}/order/accept/${orderId}`, { method: 'PATCH', headers: { Authorization: `Bearer ${tokenFor(seed.restaurants[1].ownerId)}` } });
    expect(accepted.status).toBe(200);
    await run(page, [
      ['student-payment', `/user/order/payment/${orderId}`],
      ['student-done', `/user/order/done/${orderId}`],
      ['student-failed', `/user/order/failed/${orderId}`],
      ['student-slip-failed', `/user/order/slip-failed/${orderId}`],
      ['student-refund', `/user/order/refund/${orderId}`],
    ]);

    await run(page, [
      ['student-home', '/user/restaurant'],
      ['student-menu', `/user/restaurant/${shop.restaurantId}`],
      ['student-confirm', `/user/order/confirm/${shop.restaurantId}`],
      ['student-orders', '/user/orders'],
      ['student-refunds', '/user/refunds'],
      ['student-account', '/user/account'],
      ['student-closed', '/user/closed'],
      ['student-onboarding-school', '/user/onboarding/school'],
      ['student-onboarding-notify', '/user/onboarding/notify'],
      ['onboarding', '/onboarding'],
      ['onboarding-pending', '/onboarding/pending'],
      ['workspace', '/workspace'],
      ['restaurant-register', `/cooker/restaurant-register/${student}`],
    ]);
  });

  test('shop pages', async ({ page }) => {
    await loginAndLand(page, shop.ownerId, `**/cooker/${shop.restaurantId}`);
    const r = shop.restaurantId;
    await run(page, [
      ['shop-kitchen', `/cooker/${r}`],
      ['shop-pending', `/cooker/pending/${r}`],
      ['shop-hours', `/cooker/hours/${r}`],
      ['shop-profile', `/cooker/profile/${r}`],
      ['shop-refunds', `/cooker/refunds/${r}`],
      ['shop-staff', `/cooker/staff/${r}`],
      ['shop-summary', `/cooker/summary/${r}`],
      ['shop-menu', `/cooker/restaurant/managed-menu/${r}`],
      ['shop-add-menu', `/cooker/restaurant/add-menu/${r}`],
      ['shop-add-menu-bulk', `/cooker/restaurant/add-menu-bulk/${r}`],
      ['shop-edit-menu', `/cooker/restaurant/edit-menu/${shop.menuIds[0]}`],
    ]);
  });

  test('school admin pages', async ({ page }) => {
    await loginAndLand(page, seed.schoolAdminId, `**${school}**`);
    await run(page, [
      ['school-home', school],
      ['school-approvals', `${school}/approvals`],
      ['school-audit', `${school}/audit`],
      ['school-new-canteen', `${school}/canteens/new`],
      ['school-feedback', `${school}/feedback`],
      ['school-refunds', `${school}/refunds`],
      ['school-reliability', `${school}/reliability`],
      ['school-report', `${school}/report`],
      ['school-restaurants', `${school}/restaurants`],
      ['school-restaurant', `${school}/restaurants/${shop.restaurantId}`],
      ['school-settings', `${school}/settings`],
      ['school-staff', `${school}/staff`],
    ]);
  });

  test('system admin pages', async ({ page }) => {
    // The fake identity provider issues an MFA-verified (aal2) session for ids starting with "aal2-".
    const admin = `aal2-${crypto.randomUUID()}`;
    await fetch(`${API}/user/profile`, { headers: { Authorization: `Bearer ${tokenFor(admin)}` } }); // creates the user row
    const db = `postgresql://${process.env.PGUSER || 'postgres'}${process.env.PGPASSWORD ? ':' + process.env.PGPASSWORD : ''}@${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || 55432}/${process.env.E2E_DB || 'promptserve_e2e'}`;
    execFileSync('psql', [db, '-c', `UPDATE "User" SET role = 'ADMIN' WHERE "userId" = '${admin}'`]);
    await loginAndLand(page, admin, '**/admin/schools');
    await run(page, [
      ['admin-schools', '/admin/schools'],
      ['admin-school', `/admin/schools/${seed.schoolId}`],
      ['admin-payout', '/admin/payout'],
      ['admin-mfa', '/admin/mfa'],
    ]);
  });
});
