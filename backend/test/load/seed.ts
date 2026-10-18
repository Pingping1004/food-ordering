/* Seeds the LOAD database (local Postgres only) with one pilot-sized school and writes load/data.json for k6.
 * Usage: DATABASE_URL=postgresql://postgres@localhost:55432/promptserve_load npx ts-node -r tsconfig-paths/register --transpile-only test/load/seed.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { Pool } from 'pg';

const url = process.env.DATABASE_URL ?? '';
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) throw new Error('seed.ts only runs against a local database');

const STUDENTS = Number(process.env.STUDENTS ?? 2500);
const SHOPS = Number(process.env.SHOPS ?? 12);
const MENUS_PER_SHOP = 12;

(async () => {
  const pool = new Pool({ connectionString: url });
  const q = (text: string, values: unknown[] = []) => pool.query(text, values);
  const now = new Date();

  const schoolId = randomUUID();
  await q(
    `INSERT INTO "School"("schoolId", name, email, "studentAmount", status, "updatedAt") VALUES ($1,$2,$3,$4,'ACTIVE',$5)`,
    [schoolId, `Sainampueng Pilot ${schoolId.slice(0, 4)}`, `pilot-${schoolId.slice(0, 6)}@load.local`, STUDENTS, now],
  );
  const canteenId = randomUUID();
  await q(`INSERT INTO "Canteen"("canteenId", name, status, "schoolId", "updatedAt") VALUES ($1,'Main canteen','ACTIVE',$2,$3)`, [
    canteenId,
    schoolId,
    now,
  ]);

  const restaurants: { restaurantId: string; ownerId: string; cookIds: string[]; menuIds: string[] }[] = [];
  for (let i = 0; i < SHOPS; i++) {
    const restaurantId = randomUUID();
    await q(
      `INSERT INTO "Restaurant"("restaurantId", name, email, status, "isAutoAcceptedOrder", "maxActiveOrders", "avgCookingTimeMins", "contactName","contactSurname","contactTel","contactEmail","bankType","accountNumber","accountName","paymentQr","canteenId", categories)
       VALUES ($1,$2,$3,'ACTIVE',false,2000,5,'A','B','0800000000','c@load.local','PROMPTPAY','000','T','qr',$4,'{}')`,
      [restaurantId, `Shop ${i}`, `shop${i}@load.local`, canteenId],
    );
    const ownerId = randomUUID();
    const cookIds = [randomUUID(), randomUUID()];
    for (const [uid, role] of [
      [ownerId, 'OWNER'],
      [cookIds[0], 'STAFF'],
      [cookIds[1], 'STAFF'],
    ] as const) {
      await q(`INSERT INTO "User"("userId", name, email, role, "schoolId", "updatedAt") VALUES ($1,$2,$3,'USER',$4,$5)`, [
        uid,
        `staff ${uid.slice(0, 4)}`,
        `${uid}@load.local`,
        schoolId,
        now,
      ]);
      await q(
        `INSERT INTO "RestaurantMembership"(id, role, status, "userId", "restaurantId", "updatedAt") VALUES ($1,$2,'APPROVED',$3,$4,$5)`,
        [randomUUID(), role, uid, restaurantId, now],
      );
    }
    const menuIds: string[] = [];
    for (let m = 0; m < MENUS_PER_SHOP; m++) {
      const menuId = randomUUID();
      menuIds.push(menuId);
      await q(
        `INSERT INTO "Menu"("menuId", name, price, "maxDaily", "cookingTimeMins", "isAvailable", "restaurantId", "updatedAt") VALUES ($1,$2,$3,100000,5,true,$4,$5)`,
        [menuId, `Dish ${m}`, 40 + m, restaurantId, now],
      );
    }
    restaurants.push({ restaurantId, ownerId, cookIds, menuIds });
  }

  const students: string[] = [];
  for (let start = 0; start < STUDENTS; start += 500) {
    const n = Math.min(500, STUDENTS - start);
    const params: unknown[] = [];
    const tuples: string[] = [];
    for (let j = 0; j < n; j++) {
      const id = randomUUID();
      students.push(id);
      params.push(id, `student ${start + j}`, `${id}@load.local`, schoolId, now);
      tuples.push(`($${j * 5 + 1},$${j * 5 + 2},$${j * 5 + 3},'USER',$${j * 5 + 4},$${j * 5 + 5})`);
    }
    await q(`INSERT INTO "User"("userId", name, email, role, "schoolId", "updatedAt") VALUES ${tuples.join(',')}`, params);
  }

  const extra: Record<string, unknown> = {};
  if (process.env.E2E === '1') {
    // Browser-test extras: a school admin, and a shop waiting for that admin's approval.
    const adminId = randomUUID();
    await q(`INSERT INTO "User"("userId", name, email, role, "schoolId", "updatedAt") VALUES ($1,'School Admin',$2,'USER',$3,$4)`, [adminId, `${adminId}@load.local`, schoolId, now]);
    await q(`INSERT INTO "SchoolMembership"(id, role, status, "userId", "schoolId", "updatedAt") VALUES ($1,'ADMIN','APPROVED',$2,$3,$4)`, [randomUUID(), adminId, schoolId, now]);
    const pendingId = randomUUID();
    await q(
      `INSERT INTO "Restaurant"("restaurantId", name, email, status, "isAutoAcceptedOrder", "maxActiveOrders", "avgCookingTimeMins", "contactName","contactSurname","contactTel","contactEmail","bankType","accountNumber","accountName","paymentQr","canteenId", categories)
       VALUES ($1,'Pending Noodles','pending@load.local','PENDING',false,50,5,'P','N','0811111111','p@load.local','SCB','000','T','qr',$2,'{}')`,
      [pendingId, canteenId],
    );
    const pendingOwner = randomUUID();
    await q(`INSERT INTO "User"("userId", name, email, role, "schoolId", "updatedAt") VALUES ($1,'Pending Owner',$2,'USER',$3,$4)`, [pendingOwner, `${pendingOwner}@load.local`, schoolId, now]);
    await q(`INSERT INTO "RestaurantMembership"(id, role, status, "userId", "restaurantId", "updatedAt") VALUES ($1,'OWNER','APPROVED',$2,$3,$4)`, [randomUUID(), pendingOwner, pendingId, now]);
    extra.schoolAdminId = adminId;
    extra.pending = { restaurantId: pendingId, ownerId: pendingOwner };
  }

  const out = process.env.OUT ?? path.resolve(__dirname, '../../load/data.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ schoolId, students, restaurants, ...extra }));
  console.log(`seeded school ${schoolId}: ${STUDENTS} students, ${SHOPS} shops x ${MENUS_PER_SHOP} menus`);
  await pool.end();
})();
