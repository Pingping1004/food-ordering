/**
 * One-off: give every School that has no invite code a unique one.
 *
 *   npx ts-node scripts/backfill-invite-codes.ts [--dry-run]
 *
 * Reads DATABASE_URL from backend/.env (or .env.production when NODE_ENV=production).
 * Safe to re-run: schools that already have a code are left alone.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { generateInviteCode } from '../src/utils/invite-code';

dotenv.config({ path: path.resolve(process.cwd(), process.env.NODE_ENV === 'production' ? '.env.production' : '.env') });

const dryRun = process.argv.includes('--dry-run');
const { DATABASE_URL } = process.env;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const schools = await prisma.school.findMany({ where: { inviteCode: null }, select: { schoolId: true, name: true } });
    console.log(`${schools.length} schools without an invite code${dryRun ? ' (dry run)' : ''}`);

    let updated = 0, failed = 0;
    for (const s of schools) {
      if (dryRun) { console.log(`would assign a code to ${s.name} (${s.schoolId})`); continue; }

      let done = false;
      for (let attempt = 0; attempt < 10 && !done; attempt++) {
        try {
          const candidate = generateInviteCode();
          // codes are unique across School.inviteCode AND InviteCode.code
          if (await prisma.inviteCode.findUnique({ where: { code: candidate }, select: { id: true } })) continue;
          const school = await prisma.school.update({
            where: { schoolId: s.schoolId },
            data: { inviteCode: candidate },
            select: { inviteCode: true },
          });
          console.log(`${s.name}: ${school.inviteCode}`);
          updated++;
          done = true;
        } catch (err: any) {
          if (err?.code !== 'P2002') { console.error(`FAILED ${s.name}: ${err.message}`); break; } // not a code collision
        }
      }
      if (!done) failed++;
    }
    console.log(`done: ${updated} updated, ${failed} failed`);
    if (failed) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
