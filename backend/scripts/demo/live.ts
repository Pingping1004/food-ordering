/**
 * Live demo: keeps placing orders in the demo school and moves them through the same steps the real app does
 * (shop accepts → student pays → cooking → ready → done), so cook screens, student status pages and the school
 * dashboard change while you present. Stop with Ctrl+C.
 *
 *   npm run demo:live -- --yes                         a new order about every 20 s
 *   npm run demo:live -- --yes --every 10              busier
 *   npm run demo:live -- --yes --manual tamsang        leave one shop to a real phone: its orders wait for a person
 *                                                      to press "รับออเดอร์" / "อาหารพร้อมแล้ว" (the simulated student
 *                                                      still pays after acceptance). Default manual shop: tamsang.
 *   npm run demo:live -- --yes --manual none           automate every shop
 *
 * Writes straight to the database (like the seed). Orders that are never accepted are expired by the backend's own
 * 3-minute cron, exactly as in real use.
 */
import { randomUUID } from 'crypto';
import { OrderStatus, Prisma } from '@prisma/client';
import { COMMENTS, SHOPS } from './catalog';
import { connect, flag, makeRng, option, requireYes, round5, bkkMinute, sec } from './common';

const EVERY_S = Math.max(3, Number(option('every', '20')));
const MANUAL_KEY = option('manual', 'tamsang');

type Shop = { key: string; restaurantId: string; name: string; popularity: number; autoAccept: boolean; cook: number; members: string[]; menus: { menuId: string; name: string; price: number; weight: number }[] };
type Live = { orderId: string; shop: Shop; userId: string; acceptAt: number; payAt: number; readyAt: number; doneAt: number; stage: 'new' | 'accepted' | 'paid' | 'ready' };

async function main() {
  const { prisma, pool, host } = connect();
  requireYes(host, 'start placing live demo orders');
  const rng = makeRng(Date.now() % 2 ** 31);

  const school = await prisma.school.findFirst({ where: { isDemo: true }, select: { schoolId: true, name: true } });
  if (!school) throw new Error('No demo school. Run `npm run demo:seed -- --yes` first.');
  const schoolId = school.schoolId;

  const rows = await prisma.restaurant.findMany({
    where: { canteen: { schoolId }, status: 'ACTIVE' },
    select: {
      restaurantId: true, name: true, email: true, isAutoAcceptedOrder: true, avgCookingTimeMins: true,
      menus: { where: { isAvailable: true, deletedAt: null }, select: { menuId: true, name: true, price: true } },
      memberships: { where: { status: 'APPROVED' }, select: { userId: true, role: true } },
    },
  });
  const shops: Shop[] = rows.map((r) => {
    const seed = SHOPS.find((s) => r.email.startsWith(`${s.key}@`));
    return {
      key: seed?.key ?? r.restaurantId,
      restaurantId: r.restaurantId,
      name: r.name,
      popularity: seed ? seed.popularity * (seed.canteen === 'main' ? 0.83 : 0.17) : 0.05,
      autoAccept: r.isAutoAcceptedOrder,
      cook: r.avgCookingTimeMins ?? 5,
      members: [...r.memberships].sort((a, b) => Number(a.role !== 'OWNER') - Number(b.role !== 'OWNER')).map((m) => m.userId),
      menus: r.menus.map((m) => ({ ...m, weight: seed?.menus.find((x) => x.name === m.name)?.weight ?? 1 })),
    };
  }).filter((s) => s.menus.length);
  const manual = shops.find((s) => s.key === MANUAL_KEY) ?? null;
  const students = (await prisma.user.findMany({ where: { schoolId, role: 'USER', email: { startsWith: 'student.' } }, select: { userId: true }, take: 2000 })).map((u) => u.userId);
  if (!students.length || !shops.length) throw new Error('Demo school has no students or open shops – re-run the seed.');

  console.log(`Live demo for "${school.name}": a new order about every ${EVERY_S}s.`);
  console.log(manual ? `Manual shop: ${manual.name} – accept and finish its orders on the cook's phone.` : 'All shops automated.');
  console.log('Ctrl+C to stop.\n');

  const live: Live[] = [];
  const manualWaiting = new Map<string, number>(); // orderId → when the simulated student pays (after a person accepts)
  let placed = 0;
  let stopping = false;

  const event = (name: 'restaurant_viewed' | 'menu_viewed' | 'checkout_started' | 'feedback_submitted', userId: string, restaurantId: string, metadata?: Prisma.InputJsonValue) =>
    prisma.events.create({ data: { name, source: 'student_web', userId, restaurantId, schoolId, metadata } });

  async function placeOrder() {
    const shop = rng.weighted(shops, (s) => s.popularity * (s === manual ? 1.6 : 1));
    const userId = rng.pick(students);
    const count = rng.chance(0.75) ? 1 : 2;
    const picked = new Map<string, { menuId: string; name: string; price: number; qty: number }>();
    while (picked.size < Math.min(count, shop.menus.length)) {
      const m = rng.weighted(shop.menus, (x) => x.weight);
      picked.set(m.menuId, { ...m, qty: rng.chance(0.9) ? 1 : 2 });
    }
    const items = [...picked.values()];
    const total = items.reduce((s, i) => s + i.price * i.qty, 0);
    const now = Date.now();
    const nowMin = bkkMinute(new Date(now));
    const pickupAt = new Date(now + (round5(nowMin + shop.cook + rng.between(8, 20)) - nowMin) * 60_000);
    const orderId = randomUUID();

    await event('restaurant_viewed', userId, shop.restaurantId);
    await event('menu_viewed', userId, shop.restaurantId);
    await event('checkout_started', userId, shop.restaurantId);
    await prisma.order.create({
      data: {
        orderId, restaurantId: shop.restaurantId, userId, totalAmount: total, pickupAt, status: OrderStatus.receive, paymentStatus: 'UNPAID',
        ...(shop.autoAccept ? { acceptAt: new Date() } : {}),
        orderMenus: { create: items.map((i) => ({ menuId: i.menuId, menuName: i.name, quantity: i.qty, unitPrice: i.price, totalPrice: i.price * i.qty })) },
      },
    });
    // Same "new order" push job the backend queues, so the shop's phone rings (worker runs every 5 s).
    if (shop.members[0]) {
      await prisma.pushNotificationJob.create({ data: { orderId, userId: shop.members[0], restaurantId: shop.restaurantId, eventType: 'new_order' } }).catch(() => undefined);
    }
    placed++;
    const label = items.map((i) => `${i.qty}× ${i.name}`).join(', ');
    console.log(`${new Date().toLocaleTimeString('th-TH')}  new order · ${shop.name} · ${label} · ${total} บาท${shop === manual ? '  ← waiting for you' : ''}`);

    if (shop === manual) return;
    const accept = now + (shop.autoAccept ? 1500 : sec(rng.between(12, 45)));
    const pay = accept + sec(rng.between(15, 50));
    const ready = pay + sec(Math.max(40, shop.cook * rng.between(12, 25)));
    live.push({ orderId, shop, userId, acceptAt: accept, payAt: pay, readyAt: ready, doneAt: ready + sec(rng.between(40, 120)), stage: 'new' });
  }

  async function advance() {
    const now = Date.now();
    for (const o of [...live]) {
      if (o.stage === 'new' && now >= o.acceptAt) {
        await prisma.order.updateMany({ where: { orderId: o.orderId, status: 'receive', acceptAt: null }, data: { acceptAt: new Date() } });
        await prisma.pushNotificationJob.updateMany({ where: { orderId: o.orderId, completedAt: null }, data: { completedAt: new Date(), lastError: 'acknowledged' } });
        o.stage = 'accepted';
      } else if (o.stage === 'accepted' && now >= o.payAt) {
        await prisma.order.updateMany({ where: { orderId: o.orderId, paymentStatus: 'UNPAID' }, data: { paymentStatus: 'PAID', paidAt: new Date(), status: 'cooking' } });
        o.stage = 'paid';
      } else if (o.stage === 'paid' && now >= o.readyAt) {
        await prisma.order.updateMany({ where: { orderId: o.orderId, status: { in: ['cooking', 'delay'] } }, data: { status: 'ready' } });
        o.stage = 'ready';
      } else if (o.stage === 'ready' && now >= o.doneAt) {
        await prisma.order.updateMany({ where: { orderId: o.orderId, status: 'ready' }, data: { status: 'done' } });
        if (rng.chance(0.4)) {
          const rating = rng.weighted([5, 4, 3], (r) => (r === 5 ? 6 : r === 4 ? 3 : 1));
          const comment = rng.chance(0.3) ? rng.pick(rating >= 4 ? COMMENTS.good : COMMENTS.ok) : undefined;
          await event('feedback_submitted', o.userId, o.shop.restaurantId, { orderId: o.orderId, rating, waitedLonger: false, ...(comment ? { comment } : {}) });
        }
        live.splice(live.indexOf(o), 1);
      }
    }

    // Manual shop: once a person accepts on the phone, the simulated student pays shortly after.
    if (manual) {
      const accepted = await prisma.order.findMany({
        where: { restaurantId: manual.restaurantId, status: 'receive', paymentStatus: 'UNPAID', acceptAt: { not: null }, orderAt: { gt: new Date(now - 3600_000) } },
        select: { orderId: true },
      });
      for (const { orderId } of accepted) {
        if (!manualWaiting.has(orderId)) manualWaiting.set(orderId, now + sec(rng.between(10, 25)));
        else if (now >= manualWaiting.get(orderId)!) {
          await prisma.order.updateMany({ where: { orderId, paymentStatus: 'UNPAID' }, data: { paymentStatus: 'PAID', paidAt: new Date(), status: 'cooking' } });
          manualWaiting.delete(orderId);
          console.log(`${new Date().toLocaleTimeString('th-TH')}  student paid · ${manual.name} · ${orderId.slice(0, 8)}`);
        }
      }
    }
  }

  const stop = async () => {
    if (stopping) return;
    stopping = true;
    console.log(`\nStopped. Placed ${placed} orders. Paid in-progress orders will be closed by the backend's auto-complete.`);
    await prisma.$disconnect();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  let nextOrder = Date.now();
  while (!stopping) {
    try {
      if (Date.now() >= nextOrder) {
        await placeOrder();
        nextOrder = Date.now() + sec(EVERY_S * rng.between(0.6, 1.4));
      }
      await advance();
    } catch (err) {
      console.error('tick failed:', (err as Error).message);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
