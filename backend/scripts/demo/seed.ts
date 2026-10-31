/**
 * Builds (or rebuilds) the demo-day school: canteens, shops, menus, staff, ~640 students and several weeks of
 * realistic orders, ratings, refund requests and complaints. Only rows of the demo school (School.isDemo = true)
 * and generated demo users are ever deleted or written. Real schools are untouched.
 *
 *   npm run demo:seed -- --yes                     rebuild with 3 weeks of history up to now
 *   npm run demo:seed -- --yes --weeks 4           more history
 *   npm run demo:seed -- --yes --admin you@x.com   also make your own account an admin of the demo school
 *   npm run demo:seed -- --yes --owner you@x.com   …the owner of the demo ร้านตามสั่งป้าแดง (shop pages get the switch)
 *   npm run demo:seed -- --yes --cook you@x.com    …a cook (staff) of that shop
 *   npm run demo:seed -- --yes --with-logins       create/refresh Supabase demo logins (needs DEMO_PASSWORD,
 *                                                  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
 *   npm run demo:seed -- --yes --account 1234567890  override the receiving account (default 0788542380, KBank);
 *                                                  every demo shop shows frontend/public/demo/payment-qr.jpg
 *   npm run demo:seed -- --yes --remove            delete the demo school and its generated users
 *
 * Re-run on the morning of demo day so "this week" and "today" are fresh.
 */
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { Prisma, PrismaClient, RefundReason, RefundStatus } from '@prisma/client';
import { generateGloballyUniqueCode } from '../../src/invite/unique-code';
import { CANTEENS, COMMENTS, COMPLAINTS, DEMO_LOGINS, DEMO_SCHOOL, NICKNAMES, SCHOOL_ADMINS, SHOPS, ShopSeed } from './catalog';
import { DAY_ENUM, DAY_MS, atBkk, bkkDay, bkkWeekday, connect, flag, inBatches, makeRng, option, requireYes, round5, sec, Rng } from './common';

const WEEKS = Math.max(1, Number(option('weeks', '3')));
const GEN_DOMAIN = 'demo.promptserve.local';
const emails = (name: string) => (option(name) ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const ADMIN_EMAILS = emails('admin');
/** Real accounts added to the manual demo shop, so the real ↔ demo switch appears on their shop pages too. */
const SHOP_MEMBERS = [...emails('owner').map((email) => ({ email, role: 'OWNER' as const })), ...emails('cook').map((email) => ({ email, role: 'STAFF' as const }))];
const MEMBER_SHOP_KEY = 'tamsang';
/** Top of the range the shop settings accept (1–50). */
/** The demo shops all take payment into one real PromptPay account: this QR (served by the frontend) and the account below (override with `--account <number>`); slip checks compare the number. */
const DEMO_QR_IMAGE = '/demo/payment-qr.jpg';
const DEMO_ACCOUNT_NAME = 'ปิยธนา กอจรัญจิตต์';
const DEMO_ACCOUNT_NUMBER = option('account') ?? '0788542380'; // KBank 078-8-54238-0, matches the QR above

const DEMO_MAX_ACTIVE_ORDERS = 50;
/** So no demo menu can sell out during the pitch (same value the order code assumes when a menu has no limit). */
const DEMO_DAILY_QUOTA = 999;

type Student = { userId: string; signupDay: number; appetite: number };
type ShopRow = ShopSeed & { restaurantId: string; canteenId: string; menuRows: { menuId: string; name: string; price: number; cook: number; weight: number }[] };

async function removeDemo(prisma: PrismaClient) {
  const schools = await prisma.school.findMany({ where: { isDemo: true }, select: { schoolId: true, name: true } });
  for (const s of schools) {
    const rIds = (await prisma.restaurant.findMany({ where: { canteen: { schoolId: s.schoolId } }, select: { restaurantId: true } })).map((r) => r.restaurantId);
    await prisma.events.deleteMany({ where: { OR: [{ schoolId: s.schoolId }, { restaurantId: { in: rIds } }] } });
    await prisma.payout.deleteMany({ where: { restaurantId: { in: rIds } } });
    // Orders first: OrderMenu → Menu is RESTRICT, so menus can only go once their order lines are gone.
    await prisma.order.deleteMany({ where: { restaurantId: { in: rIds } } });
    await prisma.school.delete({ where: { schoolId: s.schoolId } });
    console.log(`removed demo school "${s.name}"`);
  }
  const { count } = await prisma.user.deleteMany({ where: { email: { endsWith: `@${GEN_DOMAIN}` } } });
  if (count) console.log(`removed ${count} generated demo users`);
}

/** Supabase login for a demo role. Without --with-logins an existing account with that email is reused, else skipped. */
async function loginUser(prisma: PrismaClient, email: string, name: string, schoolId: string): Promise<string | null> {
  const existing = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { userId: true } });
  if (!flag('with-logins')) {
    if (!existing) return null;
    await prisma.user.update({ where: { userId: existing.userId }, data: { schoolId } });
    return existing.userId;
  }
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEMO_PASSWORD } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !DEMO_PASSWORD) {
    throw new Error('--with-logins needs SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DEMO_PASSWORD in the environment');
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  let id: string | undefined;
  for (let page = 1; !id; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    id = data.users.find((u) => u.email?.toLowerCase() === email)?.id;
    if (data.users.length < 1000) break;
  }
  if (id) {
    const { error } = await supabase.auth.admin.updateUserById(id, { password: DEMO_PASSWORD, email_confirm: true });
    if (error) throw error;
  } else {
    const { data, error } = await supabase.auth.admin.createUser({ email, password: DEMO_PASSWORD, email_confirm: true, user_metadata: { name } });
    if (error) throw error;
    id = data.user.id;
  }
  await prisma.user.upsert({ where: { userId: id }, create: { userId: id, email, name, schoolId }, update: { name, schoolId } });
  return id;
}

async function main() {
  const { prisma, pool, host } = connect();
  requireYes(host, flag('remove') ? 'remove the demo school' : 'rebuild the demo school');
  const rng = makeRng(20261102);
  const now = new Date();

  try {
    await removeDemo(prisma);
    if (flag('remove')) return;

    // ───────────────────────── calendar
    const today = bkkDay(now);
    const thisMonday = new Date(today.getTime() - bkkWeekday(today) * DAY_MS);
    const firstMonday = new Date(thisMonday.getTime() - (WEEKS - 1) * 7 * DAY_MS);
    const schoolDays: Date[] = [];
    for (let d = firstMonday; d <= today; d = new Date(d.getTime() + DAY_MS)) if (bkkWeekday(d) < 5) schoolDays.push(d);
    // A half day last week (sports day) shows up as a dip; a closed day next week shows on the "closed" banner.
    const sportsDay = WEEKS >= 2 ? new Date(thisMonday.getTime() - 4 * DAY_MS) : null; // last week's Thursday

    // ───────────────────────── school, hours, canteens
    const school = await prisma.school.create({
      data: {
        name: DEMO_SCHOOL.name,
        email: DEMO_SCHOOL.email,
        studentAmount: DEMO_SCHOOL.studentAmount,
        status: 'ACTIVE',
        isDemo: true,
        inviteCode: await generateGloballyUniqueCode(prisma),
        createdAt: new Date(firstMonday.getTime() - 10 * DAY_MS),
      },
    });
    const schoolId = school.schoolId;
    // Demo school, canteens and shops are open 24/7 so ordering works whenever the demo runs. The order history
    // below still follows a real school day (weekdays, lunch rush); the sports day only shapes that history.
    const ALWAYS_OPEN = DAY_ENUM.map((dayOfWeek) => ({ dayOfWeek, openMinute: 0, closeMinute: 1440 }));
    await prisma.schoolOperatingHour.createMany({ data: ALWAYS_OPEN.map((h) => ({ schoolId, ...h })) });

    const canteenIds: Record<'main' | 'junior', string> = { main: '', junior: '' };
    for (const key of ['main', 'junior'] as const) {
      const c = await prisma.canteen.create({ data: { name: CANTEENS[key].name, status: 'ACTIVE', schoolId } });
      canteenIds[key] = c.canteenId;
      await prisma.canteenOperatingHour.createMany({
        data: ALWAYS_OPEN.map((h) => ({ canteenId: c.canteenId, ...h })),
      });
    }

    // ───────────────────────── people
    const genUser = (name: string, kind: string, createdAt: Date): Prisma.UserCreateManyInput => ({
      userId: randomUUID(), name, email: `${kind}.${randomUUID().slice(0, 8)}@${GEN_DOMAIN}`, schoolId, createdAt,
    });
    const setupDay = new Date(firstMonday.getTime() - 5 * DAY_MS);

    const adminLogin = await loginUser(prisma, DEMO_LOGINS.schoolAdmin.email, DEMO_LOGINS.schoolAdmin.name, schoolId);
    const schoolAdmin = adminLogin ? { userId: adminLogin } : genUser('ครูสมใจ', 'staff', setupDay);
    const otherAdmins = SCHOOL_ADMINS.map((s) => ({ ...s, user: genUser(s.name, 'staff', setupDay) }));
    const cookLogin = await loginUser(prisma, DEMO_LOGINS.cook.email, DEMO_LOGINS.cook.name, schoolId);
    const studentLogin = await loginUser(prisma, DEMO_LOGINS.student.email, DEMO_LOGINS.student.name, schoolId);

    const shopPeople = SHOPS.map((s) => ({
      key: s.key,
      owner: s.key === 'tamsang' && cookLogin ? { userId: cookLogin } : genUser(s.owner, 'shop', setupDay),
      staff: s.staff.map((n) => genUser(n, 'shop', setupDay)),
    }));

    const totalDays = schoolDays.length;
    const students: Student[] = [];
    const studentRows: Prisma.UserCreateManyInput[] = [];
    for (let i = 0; i < DEMO_SCHOOL.signedUpStudents; i++) {
      // Adoption: ~35 % sign up in the first days, the rest trickle in across the period.
      const signupDay = rng.chance(0.35) ? rng.int(0, 1) : Math.floor(Math.pow(rng.next(), 0.8) * totalDays);
      const name = `${rng.pick(NICKNAMES)} ม.${rng.int(1, 6)}/${rng.int(1, 8)}`;
      const row = genUser(name, 'student', atBkk(schoolDays[Math.min(signupDay, totalDays - 1)], 7 * 60 + rng.int(0, 600)));
      studentRows.push(row);
      students.push({ userId: row.userId!, signupDay, appetite: Math.min(6, rng.logNormal(1, 0.8)) });
    }
    if (studentLogin) students.push({ userId: studentLogin, signupDay: 0, appetite: 3 });

    const generated = [
      ...(adminLogin ? [] : [schoolAdmin as Prisma.UserCreateManyInput]),
      ...otherAdmins.map((s) => s.user),
      ...shopPeople.flatMap((p) => [...('email' in p.owner ? [p.owner] : []), ...p.staff]),
      ...studentRows,
    ];
    await inBatches(generated, 500, (chunk) => prisma.user.createMany({ data: chunk }));

    await prisma.schoolMembership.createMany({
      data: [
        { userId: schoolAdmin.userId!, schoolId, role: 'ADMIN', status: 'APPROVED' },
        ...otherAdmins.map((s) => ({ userId: s.user.userId!, schoolId, role: 'ADMIN' as const, status: s.status })),
      ],
    });
    for (const email of ADMIN_EMAILS) {
      const u = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { userId: true } });
      if (!u) { console.warn(`--admin ${email}: no user with that email (log in once first)`); continue; }
      await prisma.schoolMembership.upsert({
        where: { userId_schoolId: { userId: u.userId, schoolId } },
        create: { userId: u.userId, schoolId, role: 'ADMIN', status: 'APPROVED' },
        update: { role: 'ADMIN', status: 'APPROVED' },
      });
      console.log(`${email} is now an admin of the demo school`);
    }

    // ───────────────────────── shops & menus
    const shops: ShopRow[] = [];
    for (const s of SHOPS) {
      const people = shopPeople.find((p) => p.key === s.key)!;
      const r = await prisma.restaurant.create({
        data: {
          name: s.name, email: `${s.key}@${GEN_DOMAIN}`, location: s.location, categories: s.categories,
          // A student order on stage must never bounce: no queue limit in practice, and only the shop on the cook's
          // phone waits for a person (every other shop would expire the order after 3 minutes).
          maxActiveOrders: DEMO_MAX_ACTIVE_ORDERS, avgCookingTimeMins: s.avgCookingTimeMins, status: s.status ?? 'ACTIVE',
          isAutoAcceptedOrder: s.key !== MEMBER_SHOP_KEY, contactName: s.owner, contactSurname: '-', contactTel: `08${rng.int(10000000, 99999999)}`,
          contactEmail: `${s.key}@${GEN_DOMAIN}`, bankType: 'KASIKORN_BANK', accountNumber: DEMO_ACCOUNT_NUMBER,
          accountName: DEMO_ACCOUNT_NAME, paymentQr: DEMO_QR_IMAGE, canteenId: canteenIds[s.canteen],
        },
      });
      await prisma.restaurantOperatingHour.createMany({ data: ALWAYS_OPEN.map((h) => ({ restaurantId: r.restaurantId, ...h })) });
      await prisma.restaurantMembership.createMany({
        data: [
          { userId: people.owner.userId!, restaurantId: r.restaurantId, role: 'OWNER', status: 'APPROVED' },
          ...people.staff.map((u) => ({ userId: u.userId!, restaurantId: r.restaurantId, role: 'STAFF' as const, status: 'APPROVED' as const })),
        ],
      });
      const menuRows = s.menus.map((m) => ({ menuId: randomUUID(), name: m.name, price: m.price, cook: m.cook, weight: m.weight, maxDaily: m.fixedStock ? m.maxDaily : DEMO_DAILY_QUOTA }));
      await prisma.menu.createMany({
        data: menuRows.map((m) => ({ menuId: m.menuId, name: m.name, price: m.price, cookingTimeMins: m.cook, maxDaily: m.maxDaily, restaurantId: r.restaurantId, createdAt: setupDay })),
      });
      shops.push({ ...s, restaurantId: r.restaurantId, canteenId: canteenIds[s.canteen], menuRows });
    }
    const openShops = shops.filter((s) => (s.status ?? 'ACTIVE') === 'ACTIVE');
    const memberShop = shops.find((s) => s.key === MEMBER_SHOP_KEY);
    for (const { email, role } of memberShop ? SHOP_MEMBERS : []) {
      const u = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { userId: true } });
      if (!u) { console.warn(`--${role === 'OWNER' ? 'owner' : 'cook'} ${email}: no user with that email (log in once first)`); continue; }
      await prisma.restaurantMembership.upsert({
        where: { userId_restaurantId: { userId: u.userId, restaurantId: memberShop!.restaurantId } },
        create: { userId: u.userId, restaurantId: memberShop!.restaurantId, role, status: 'APPROVED' },
        update: { role, status: 'APPROVED' },
      });
      console.log(`${email} is now ${role === 'OWNER' ? 'an owner' : 'a cook'} of demo shop ${memberShop!.name}`);
    }

    // ───────────────────────── orders
    const orders: Prisma.OrderCreateManyInput[] = [];
    const lines: Prisma.OrderMenuCreateManyInput[] = [];
    const events: Prisma.EventsCreateManyInput[] = [];
    const refundCandidates: { orderId: string; userId: string; restaurantId: string; amount: number; at: Date; reason: RefundReason; lineAmount: number }[] = [];
    const doneOrders: { orderId: string; userId: string; restaurantId: string; at: Date; shopKey: string; amount: number; lineAmount: number }[] = [];

    const ev = (name: Prisma.EventsCreateManyInput['name'], at: Date, userId: string, restaurantId: string, metadata?: Prisma.InputJsonValue) => {
      if (at > now) return;
      events.push({ name, source: 'student_web', userId, restaurantId, schoolId, metadata, createdAt: at });
    };

    schoolDays.forEach((day, dayIdx) => {
      const week = Math.floor((day.getTime() - firstMonday.getTime()) / (7 * DAY_MS));
      const progress = WEEKS > 1 ? week / (WEEKS - 1) : 1;
      const dowFactor = [0.86, 1, 1.12, 1.05, 0.82][bkkWeekday(day)];
      const halfDay = sportsDay && day.getTime() === sportsDay.getTime();
      const target = Math.round((95 + 160 * progress) * dowFactor * rng.normal(1, 0.07) * (halfDay ? 0.4 : 1));
      const pool = students.filter((s) => s.signupDay <= dayIdx);
      if (!pool.length) return;

      for (let n = 0; n < target; n++) {
        const user = rng.weighted(pool, (s) => s.appetite);
        // When the order is placed (Bangkok minutes) and the pickup time the student chose.
        const r = rng.next();
        let orderMin: number;
        let pickupMin: number;
        let shop: ShopRow;
        if (r < 0.12) {
          shop = rng.weighted(openShops.filter((s) => s.morning), (s) => s.popularity);
          orderMin = rng.normal(9 * 60 + 35, 10);
          pickupMin = round5(Math.max(orderMin + rng.between(6, 20), shop.open + 5));
        } else {
          const canteen = rng.chance(0.83) ? 'main' : 'junior';
          shop = rng.weighted(openShops.filter((s) => s.canteen === canteen), (s) => s.popularity);
          if (r < 0.27) orderMin = rng.normal(10 * 60 + 45, 25); // ordered during class for lunch
          else if (r < 0.88) orderMin = rng.chance(0.4) ? rng.normal(11 * 60 + 30, 16) : rng.normal(11 * 60 + 55, 11);
          else orderMin = rng.normal(12 * 60 + 45, 14);
          const lunch = orderMin < 12 * 60 + 15 ? rng.normal(12 * 60 + 12, 11) : orderMin + rng.between(10, 25);
          pickupMin = round5(Math.max(lunch, orderMin + shop.avgCookingTimeMins + rng.between(4, 9), shop.open + 5));
        }
        if (halfDay && pickupMin > 11 * 60 + 25) pickupMin = round5(11 * 60 + rng.between(0, 20));
        if (pickupMin > shop.close - 5 || orderMin < 6 * 60 + 30) { n--; continue; }

        const orderAt = atBkk(day, orderMin);
        if (orderAt > now) continue;
        let pickupAt = atBkk(day, pickupMin);
        const peak = pickupMin >= 11 * 60 + 55 && pickupMin <= 12 * 60 + 25;

        // items
        const count = rng.chance(0.72) ? 1 : rng.chance(0.78) ? 2 : 3;
        const chosen = new Map<string, { m: ShopRow['menuRows'][number]; qty: number }>();
        while (chosen.size < Math.min(count, shop.menuRows.length)) {
          const m = rng.weighted(shop.menuRows, (x) => x.weight);
          if (!chosen.has(m.menuId)) chosen.set(m.menuId, { m, qty: rng.chance(0.88) ? 1 : 2 });
        }
        const orderId = randomUUID();
        let total = 0;
        for (const { m, qty } of chosen.values()) {
          total += m.price * qty;
          lines.push({ orderId, menuId: m.menuId, menuName: m.name, quantity: qty, unitPrice: m.price, totalPrice: m.price * qty });
        }
        const firstLine = [...chosen.values()][0];

        // browsing before ordering (client events, as the student web app sends them)
        ev('restaurant_viewed', new Date(orderAt.getTime() - sec(rng.between(40, 300))), user.userId, shop.restaurantId);
        ev('menu_viewed', new Date(orderAt.getTime() - sec(rng.between(25, 150))), user.userId, shop.restaurantId);
        ev('checkout_started', new Date(orderAt.getTime() - sec(rng.between(8, 50))), user.userId, shop.restaurantId);

        // outcome
        const acceptSec = shop.autoAccept
          ? rng.between(1, 3)
          : Math.min(170, Math.max(6, rng.logNormal((64 - 22 * progress) * shop.acceptSlowness * (peak ? 1.25 : 1), 0.55)));
        const payLagSec = Math.min(280, Math.max(10, rng.logNormal(45, 0.6)));
        const pExpire = shop.autoAccept ? 0 : (0.022 - 0.009 * progress) * shop.acceptSlowness;
        const roll = rng.next();
        const outcome =
          roll < 0.011 + (peak ? 0.008 : 0) ? 'shop_rejected'
            : roll < 0.011 + (peak ? 0.008 : 0) + pExpire ? 'expired'
              : roll < 0.023 + (peak ? 0.008 : 0) + pExpire ? 'no_pay'
                : roll < 0.027 + (peak ? 0.008 : 0) + pExpire ? 'paid_cancelled'
                  : 'done';
        const acceptAt = new Date(orderAt.getTime() + sec(acceptSec));
        const paidAt = new Date(acceptAt.getTime() + sec(payLagSec));
        const isDelay = outcome === 'done' && rng.chance(shop.delayRate * (peak ? 1.6 : 1) * (1 - 0.3 * progress));
        if (isDelay) pickupAt = new Date(pickupAt.getTime() + 10 * 60_000);

        const base: Prisma.OrderCreateManyInput = { orderId, restaurantId: shop.restaurantId, userId: user.userId, totalAmount: total, orderAt, pickupAt, updatedAt: orderAt };
        const finished = (t: Date) => t <= now;

        if (outcome === 'shop_rejected' && finished(new Date(orderAt.getTime() + 90_000))) {
          orders.push({ ...base, status: 'rejected', paymentStatus: 'UNPAID', updatedAt: new Date(orderAt.getTime() + sec(rng.between(20, 90))) });
          continue;
        }
        if (outcome === 'expired' && finished(new Date(orderAt.getTime() + 180_000))) {
          orders.push({ ...base, status: 'rejected', paymentStatus: 'UNPAID', updatedAt: new Date(orderAt.getTime() + 180_000) });
          continue;
        }
        if (outcome === 'no_pay' && finished(new Date(acceptAt.getTime() + 300_000))) {
          orders.push({ ...base, status: 'rejected', paymentStatus: 'UNPAID', acceptAt, updatedAt: new Date(acceptAt.getTime() + 300_000) });
          continue;
        }
        if (outcome === 'paid_cancelled' && finished(new Date(paidAt.getTime() + 600_000))) {
          const cancelledAt = new Date(paidAt.getTime() + sec(rng.between(120, 600)));
          orders.push({ ...base, status: 'rejected', paymentStatus: 'PAID', acceptAt, paidAt, updatedAt: cancelledAt });
          refundCandidates.push({ orderId, userId: user.userId, restaurantId: shop.restaurantId, amount: total, at: new Date(cancelledAt.getTime() + sec(rng.between(60, 3600))), reason: 'SHOP_CANCELLED', lineAmount: firstLine.m.price });
          continue;
        }

        // Normal path. Today's orders that are still in progress get the status they would have right now.
        const readyAt = new Date(pickupAt.getTime() - sec(rng.between(0, 150)));
        const doneAt = new Date(pickupAt.getTime() + sec(rng.between(30, 600)));
        if (now < acceptAt) orders.push({ ...base, status: 'receive', paymentStatus: 'UNPAID', ...(shop.autoAccept ? { acceptAt: orderAt } : {}) });
        else if (now < paidAt) orders.push({ ...base, status: 'receive', paymentStatus: 'UNPAID', acceptAt });
        else if (now < readyAt) orders.push({ ...base, status: isDelay ? 'delay' : 'cooking', isDelay, paymentStatus: 'PAID', acceptAt, paidAt, updatedAt: paidAt });
        else if (now < doneAt) orders.push({ ...base, status: 'ready', isDelay, paymentStatus: 'PAID', acceptAt, paidAt, updatedAt: readyAt });
        else {
          orders.push({ ...base, status: 'done', isDelay, paymentStatus: 'PAID', acceptAt, paidAt, updatedAt: doneAt });
          doneOrders.push({ orderId, userId: user.userId, restaurantId: shop.restaurantId, at: doneAt, shopKey: shop.key, amount: total, lineAmount: firstLine.m.price });
          // rating after pickup
          if (rng.chance(0.36)) {
            const meanRating = shop.ratingBase - (isDelay ? 1.3 : 0);
            const rating = Math.min(5, Math.max(1, Math.round(rng.normal(meanRating, 0.7))));
            const waitedLonger = isDelay ? rng.chance(0.75) : rng.chance(0.06);
            const pool2 = rating >= 4 ? COMMENTS.good : rating === 3 ? COMMENTS.ok : COMMENTS.bad;
            const comment = rng.chance(0.24) ? rng.pick(pool2) : undefined;
            const at = new Date(doneAt.getTime() + sec(rng.between(60, 2400)));
            ev('feedback_submitted', at, user.userId, shop.restaurantId, { orderId, rating, waitedLonger, ...(comment ? { comment } : {}) });
          }
        }
      }

      // Browsing that did not turn into an order.
      for (let k = 0; k < target * 1.3; k++) {
        const shop = rng.weighted(openShops, (s) => s.popularity);
        const user = rng.pick(pool);
        const at = atBkk(day, rng.normal(11 * 60 + 20, 70));
        ev('restaurant_viewed', at, user.userId, shop.restaurantId);
        if (rng.chance(0.5)) ev('menu_viewed', new Date(at.getTime() + sec(rng.between(5, 60))), user.userId, shop.restaurantId);
        if (rng.chance(0.08)) ev('checkout_started', new Date(at.getTime() + sec(rng.between(30, 120))), user.userId, shop.restaurantId);
      }
    });

    await inBatches(orders, 500, (chunk) => prisma.order.createMany({ data: chunk }));
    await inBatches(lines, 1000, (chunk) => prisma.orderMenu.createMany({ data: chunk }));
    await inBatches(events, 2000, (chunk) => prisma.events.createMany({ data: chunk }));

    // ───────────────────────── refund requests (handled by the school, no money moves through the system)
    const refundRows = buildRefunds(rng, refundCandidates, doneOrders, now, schoolId, schoolAdmin.userId!);
    for (const r of refundRows) await prisma.refundRequest.create({ data: r });
    const refunded = refundRows.filter((r) => r.status === 'REFUNDED').map((r) => r.orderId);
    if (refunded.length) await prisma.order.updateMany({ where: { orderId: { in: refunded } }, data: { paymentStatus: 'REFUNDED' } });

    // ───────────────────────── complaints
    const complaintRows = COMPLAINTS.flatMap((c, i) => {
      const shop = shops.find((s) => s.key === c.shop)!;
      const candidates = doneOrders.filter((o) => o.restaurantId === shop.restaurantId);
      if (!candidates.length) return [];
      const o = candidates[candidates.length - 1 - i * 7] ?? candidates[candidates.length - 1];
      const createdAt = new Date(o.at.getTime() + sec(rng.between(300, 5400)));
      return [{
        orderId: o.orderId, userId: o.userId, schoolId, restaurantId: o.restaurantId, target: c.target, message: c.message,
        status: c.resolved ? ('RESOLVED' as const) : ('OPEN' as const),
        resolvedAt: c.resolved ? new Date(createdAt.getTime() + sec(rng.between(3600, 86400))) : null,
        createdAt: createdAt > now ? now : createdAt,
      }];
    });
    await prisma.complaint.createMany({ data: complaintRows });

    // ───────────────────────── report
    const done = orders.filter((o) => o.status === 'done').length;
    console.log(`\nDemo school ready: ${school.name}`);
    console.log(`  schoolId     ${schoolId}`);
    console.log(`  student code ${school.inviteCode}`);
    console.log(`  ${schoolDays.length} school days · ${shops.length} shops (${openShops.length} open) · ${studentRows.length + (studentLogin ? 1 : 0)} students`);
    console.log(`  ${orders.length} orders (${done} done, ${orders.length - done} other) · ${events.length} events · ${refundRows.length} refund requests · ${complaintRows.length} complaints`);
    console.log(`  logins: school ${adminLogin ? DEMO_LOGINS.schoolAdmin.email : '–'} · cook ${cookLogin ? DEMO_LOGINS.cook.email : '–'} · student ${studentLogin ? DEMO_LOGINS.student.email : '–'}`);
    if (!flag('with-logins')) console.log('  (run with --with-logins to create the demo login accounts)');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

function buildRefunds(
  rng: Rng,
  cancelled: { orderId: string; userId: string; restaurantId: string; amount: number; at: Date; reason: RefundReason; lineAmount: number }[],
  done: { orderId: string; userId: string; restaurantId: string; at: Date; amount: number; lineAmount: number }[],
  now: Date,
  schoolId: string,
  adminId: string,
): Prisma.RefundRequestUncheckedCreateInput[] {
  const complaints: { reason: RefundReason; details: string; partial: boolean }[] = [
    { reason: 'MISSING_ITEM', details: 'สั่ง 2 อย่าง ได้อย่างเดียว', partial: true },
    { reason: 'WRONG_ORDER', details: 'ได้ผัดซีอิ๊วแทนราดหน้า', partial: false },
    { reason: 'LATE_OR_NOT_READY', details: 'ไปรับตามเวลาแล้วยังไม่ได้ทำ ต้องกลับเข้าเรียน', partial: false },
    { reason: 'QUALITY', details: 'อาหารเย็นและแข็ง', partial: false },
  ];
  const fromDone = complaints.flatMap((c, i) => {
    const o = done[Math.max(0, done.length - 40 - i * 60)];
    return o ? [{ ...o, at: new Date(o.at.getTime() + sec(rng.between(600, 4000))), reason: c.reason, details: c.details, amount: c.partial ? o.lineAmount : o.amount }] : [];
  });
  const all = [...cancelled.map((c) => ({ ...c, details: 'ร้านกดยกเลิกหลังจ่ายเงินแล้ว' })), ...fromDone]
    .filter((r) => r.at <= now)
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  return all.map((r, i) => {
    const recent = i >= all.length - 2 || now.getTime() - r.at.getTime() < 36 * 3600 * 1000;
    const status: RefundStatus = recent ? 'PENDING' : rng.weighted(['REFUNDED', 'REFUNDED', 'REFUNDED', 'APPROVED', 'REJECTED'] as RefundStatus[], () => 1);
    const decidedAt = recent ? null : new Date(r.at.getTime() + sec(rng.between(1800, 30000)));
    return {
      orderId: r.orderId, userId: r.userId, restaurantId: r.restaurantId, schoolId,
      reason: r.reason, details: r.details, amount: r.amount, status,
      activeOrderId: status === 'REJECTED' ? null : r.orderId,
      decidedById: decidedAt ? adminId : null,
      decisionNote: status === 'REFUNDED' ? 'ร้านโอนคืนบัญชีเดิมแล้ว' : status === 'APPROVED' ? 'แจ้งร้านแล้ว รอร้านโอนคืน' : status === 'REJECTED' ? 'ตรวจสอบแล้วร้านทำครบตามออเดอร์' : null,
      decidedAt,
      refundedAt: status === 'REFUNDED' && decidedAt ? new Date(decidedAt.getTime() + sec(rng.between(1800, 20000))) : null,
      createdAt: r.at,
    };
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
