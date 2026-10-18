/**
 * Make an existing user the system admin (User.role = ADMIN). This is the ONLY way to become one.
 * The user must have logged in at least once so a User row exists.
 *
 *   npx ts-node scripts/make-system-admin.ts <email>
 *
 * Reads DATABASE_URL from backend/.env (or .env.production when NODE_ENV=production).
 * Exit codes: 0 ok · 1 usage/config/db error · 2 no user with that email.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '@prisma/client';
import { Pool } from 'pg';

dotenv.config({ path: path.resolve(process.cwd(), process.env.NODE_ENV === 'production' ? '.env.production' : '.env') });

const email = process.argv[2]?.trim().toLowerCase();
const { DATABASE_URL } = process.env;
if (!email || !email.includes('@')) {
  console.error('Usage: npx ts-node scripts/make-system-admin.ts <email>');
  process.exit(1);
}
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { userId: true, email: true, role: true } });
    if (!user) {
      console.error(`No user row found for ${email}. Log in once with this account so it is created, then re-run this script.`);
      process.exitCode = 2;
      return;
    }
    if (user.role === Role.ADMIN) {
      console.log(`${user.email} is already a system admin (${user.userId})`);
      return;
    }
    await prisma.user.update({ where: { userId: user.userId }, data: { role: Role.ADMIN } });
    console.log(`${user.email} (${user.userId}) is now a system admin (was ${user.role}). TOTP MFA is required to use /admin.`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
