/**
 * One-off: copy existing users into Supabase Auth, keeping the SAME uuid and the existing bcrypt hash,
 * so nobody has to reset their password and every foreign key (memberships, roles, orders…) stays valid.
 *
 * RUN THIS BEFORE `prisma db push` / migrate with the new schema – the new schema drops "User"."password",
 * and with it the only copy of the hashes.
 *
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… DATABASE_URL=… \
 *   npx ts-node scripts/migrate-users-to-supabase.ts [--dry-run]
 *
 * Safe to re-run: users that already exist in Supabase are skipped.
 */
import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';

const dryRun = process.argv.includes('--dry-run');
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !DATABASE_URL) {
  console.error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DATABASE_URL are required');
  process.exit(1);
}

type Row = { userId: string; email: string | null; name: string; password: string | null };

async function main() {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

  const { rows } = await pool.query<Row>('SELECT "userId", email, name, password FROM "User" WHERE email IS NOT NULL');
  console.log(`${rows.length} users to migrate${dryRun ? ' (dry run)' : ''}`);

  let created = 0, skipped = 0, failed = 0;
  for (const u of rows) {
    if (!u.email) continue;
    if (dryRun) { console.log(`would create ${u.email} (${u.userId})`); continue; }

    const { error } = await supabase.auth.admin.createUser({
      id: u.userId,
      email: u.email,
      email_confirm: true, // they already own the address; do not force a re-verification
      ...(u.password ? { password_hash: u.password } : {}), // bcrypt ($2a/$2b) is accepted as-is
      user_metadata: { name: u.name },
    } as Parameters<typeof supabase.auth.admin.createUser>[0]);

    if (!error) created++;
    else if (/already (been )?registered|already exists|duplicate/i.test(error.message)) skipped++;
    else { failed++; console.error(`FAILED ${u.email}: ${error.message}`); }
  }

  console.log(`done – created ${created}, skipped ${skipped}, failed ${failed}`);
  await pool.end();
  if (failed) process.exit(2);
}

main().catch((e) => { console.error(e); process.exit(1); });
