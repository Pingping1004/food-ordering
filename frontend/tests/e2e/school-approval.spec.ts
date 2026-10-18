import { test, expect } from '@playwright/test';
import { apiGet, loginAndLand, seed } from './support/helpers';

test.describe('School admin approves a new shop; students then see it', () => {
  test('pending shop is hidden from students, approved by the school admin, then visible', async ({ browser }) => {
    const adminCtx = await browser.newContext();
    const studentCtx = await browser.newContext();

    // before: a student cannot see the shop (API: 404) and the list does not show it
    expect((await apiGet(seed.students[4], `/restaurant/${seed.pending.restaurantId}`)).status).toBe(404);
    const student = await studentCtx.newPage();
    await loginAndLand(student, seed.students[4], '**/user/restaurant');
    await expect(student.getByRole('link', { name: /Shop 0/ })).toBeVisible();
    await expect(student.getByText('Pending Noodles')).toHaveCount(0);

    // the admin sees it in the approval queue and approves
    const admin = await adminCtx.newPage();
    await loginAndLand(admin, seed.schoolAdminId, `**/school/${seed.schoolId}`);
    await admin.goto(`/school/${seed.schoolId}/approvals`);
    await expect(admin.getByText('Pending Noodles')).toBeVisible();
    await admin.getByRole('button', { name: 'อนุมัติ', exact: true }).click();
    // the queue empties (the success toast repeats the shop's name, so assert on the empty state instead)
    await expect(admin.getByText('ไม่มีรายการรออนุมัติ')).toBeVisible({ timeout: 20_000 });

    // after: the shop is ACTIVE and the student can open it
    await expect.poll(async () => (await apiGet(seed.students[4], `/restaurant/${seed.pending.restaurantId}`)).status, { timeout: 20_000 }).toBe(200);
    await student.reload();
    await expect(student.getByRole('link', { name: /Pending Noodles/ })).toBeVisible({ timeout: 20_000 });

    await adminCtx.close();
    await studentCtx.close();
  });
});
