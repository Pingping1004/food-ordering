/** Shared helpers for the demo scripts: DB connection, safety prompt, seeded randomness, Bangkok time. */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

dotenv.config({ path: path.resolve(process.cwd(), process.env.NODE_ENV === 'production' ? '.env.production' : '.env') });

export const args = process.argv.slice(2);
export const flag = (name: string) => args.includes(`--${name}`);
export const option = (name: string, fallback?: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};

export function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required (backend/.env, or .env.production with NODE_ENV=production)');
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  const pool = new Pool({ connectionString: url, ...(local ? {} : { ssl: { rejectUnauthorized: false } }) });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const host = url.replace(/^.*@/, '').replace(/\/.*$/, '');
  return { prisma, pool, host };
}

/** Writing scripts print the target and stop unless --yes is passed. */
export function requireYes(host: string, what: string) {
  console.log(`Target database: ${host}`);
  if (!flag('yes')) {
    console.log(`Dry stop: re-run with --yes to ${what}. Only the demo school (School.isDemo = true) is touched.`);
    process.exit(0);
  }
}

/** Deterministic PRNG (mulberry32) so every seed run produces the same story. */
export function makeRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng = {
    next,
    between: (min: number, max: number) => min + next() * (max - min),
    int: (min: number, max: number) => Math.floor(min + next() * (max - min + 1)),
    chance: (p: number) => next() < p,
    pick: <T>(list: readonly T[]) => list[Math.floor(next() * list.length)],
    weighted: <T>(list: readonly T[], weight: (x: T) => number) => {
      const total = list.reduce((s, x) => s + weight(x), 0);
      let r = next() * total;
      for (const x of list) {
        r -= weight(x);
        if (r <= 0) return x;
      }
      return list[list.length - 1];
    },
    /** Normal(mean, sd) via Box–Muller. */
    normal: (mean: number, sd: number) => {
      const u = Math.max(next(), 1e-9);
      const v = next();
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    /** Log-normal with the given median (most values near it, a long slow tail). */
    logNormal: (median: number, spread: number) => {
      const u = Math.max(next(), 1e-9);
      const v = next();
      return median * Math.exp(spread * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v));
    },
  };
  return rng;
}
export type Rng = ReturnType<typeof makeRng>;

/** Bangkok is UTC+7 all year (no DST). */
const BKK_MS = 7 * 3600 * 1000;
export const DAY_MS = 24 * 3600 * 1000;

/** Bangkok calendar day of a moment, as a UTC-midnight Date (for @db.Date columns and day arithmetic). */
export function bkkDay(at: Date) {
  const t = new Date(at.getTime() + BKK_MS);
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
}
/** The moment `minute` minutes after Bangkok midnight on `day` (a bkkDay value). */
export function atBkk(day: Date, minute: number) {
  return new Date(day.getTime() - BKK_MS + Math.round(minute * 60_000));
}
/** Minutes after Bangkok midnight. */
export function bkkMinute(at: Date) {
  const t = new Date(at.getTime() + BKK_MS);
  return t.getUTCHours() * 60 + t.getUTCMinutes() + t.getUTCSeconds() / 60;
}
/** 0 = Monday … 6 = Sunday, Bangkok time. */
export function bkkWeekday(day: Date) {
  return (day.getUTCDay() + 6) % 7;
}
export const round5 = (minute: number) => Math.ceil(minute / 5) * 5;
export const sec = (s: number) => s * 1000;

export const DAY_ENUM = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const;

/** Inserts in batches so one call never builds a huge statement. */
export async function inBatches<T>(rows: T[], size: number, run: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += size) await run(rows.slice(i, i + size));
}
