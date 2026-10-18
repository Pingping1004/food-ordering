/**
 * One-off: payouts used to live only in API memory, so every restart erased the shops' payment history. This
 * creates a Payout row for each already-PAID order that has none, so weekly statements are complete from the
 * pilot's first day. Bank transaction references were never stored, so these rows have transactionId = null
 * (they cannot be used to detect slip reuse for those past orders; nothing can).
 *
 *   npx ts-node scripts/backfill-payouts.ts           # dry run: prints what it would create
 *   npx ts-node scripts/backfill-payouts.ts --apply   # writes the rows
 *
 * Reads DATABASE_URL from backend/.env (or .env.production when NODE_ENV=production). Safe to re-run: orders that
 * already have a payout are skipped. Run the Prisma schema push first so the Payout table exists.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

dotenv.config({ path: path.resolve(process.cwd(), process.env.NODE_ENV === 'production' ? '.env.production' : '.env') });

const apply = process.argv.includes('--apply');
const { DATABASE_URL } = process.env;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

async function main() {
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(DATABASE_URL!);
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: local ? false : { rejectUnauthorized: false } });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    const feePerSlip = Number(process.env.PAYMENT_VERIFICATION_API_FEE ?? '0');
    let created = 0;
    let skipped = 0;
    let cursor: string | undefined;
    for (;;) {
      const orders = await prisma.order.findMany({
        where: { paymentStatus: { in: ['PAID', 'REFUNDED'] } },
        include: { restaurant: { select: { name: true } } },
        orderBy: { orderId: 'asc' },
        take: 500,
        ...(cursor ? { cursor: { orderId: cursor }, skip: 1 } : {}),
      });
      if (orders.length === 0) break;
      cursor = orders[orders.length - 1].orderId;

      const have = new Set(
        (await prisma.payout.findMany({ where: { orderId: { in: orders.map((o) => o.orderId) } }, select: { orderId: true } })).map((p) => p.orderId),
      );
      const missing = orders.filter((o) => !have.has(o.orderId));
      skipped += orders.length - missing.length;
      if (apply && missing.length) {
        await prisma.payout.createMany({
          data: missing.map((o) => {
            const paidAt = o.paidAt ?? o.orderAt;
            return {
              orderId: o.orderId,
              restaurantId: o.restaurantId,
              restaurantName: o.restaurant.name,
              payoutStatus: 'success',
              grossAmount: o.totalAmount,
              restaurantRevenue: o.totalAmount,
              platformFee: -feePerSlip,
              transactionFee: feePerSlip,
              vat: 0,
              startDate: paidAt,
              endDate: paidAt,
              paidAt,
            };
          }),
        });
      }
      created += missing.length;
    }
    console.log(`${apply ? 'created' : 'would create'} ${created} payout rows; ${skipped} paid orders already had one.`);
    if (!apply) console.log('Dry run only. Re-run with --apply to write.');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
