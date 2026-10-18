import * as fs from 'fs';
import * as path from 'path';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { Messaging } from 'firebase-admin/messaging';

// Load .env.test (no real credentials) BEFORE AppModule is imported, and refuse to run against a non-local DB.
process.env.NODE_ENV = 'test';
const envFile = path.resolve(__dirname, '../../.env.test');
for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
}
const dbUrl = process.env.DATABASE_URL ?? '';
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(dbUrl)) {
  throw new Error(`Integration tests only run against a local database, got: ${dbUrl.replace(/:[^@]+@/, ':***@')}`);
}

import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { PrismaService } from '../../src/prisma/prisma.service';
import { SupabaseService } from '../../src/supabase/supabase.service';
import { FIREBASE_ADMIN_MESSAGING } from '../../src/notification/firebase-admin.provider';

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
/** A JWT-shaped token (`aal2-` user ids get aal2, like a TOTP-verified sysadmin). The fake Supabase client below "verifies" it. */
export const tokenFor = (userId: string) => `h.${b64({ sub: userId, aal: userId.startsWith('aal2-') ? 'aal2' : 'aal1' })}.s`;
export const authHeader = (userId: string) => ({ Authorization: `Bearer ${tokenFor(userId)}` });

export interface TestApp {
  app: NestExpressApplication;
  prisma: PrismaService;
  /** Base URL of the one real listening server; use `request(t.url)` so concurrent requests share it. */
  url: string;
  close: () => Promise<void>;
}

/** Boots the real AppModule + the real production middleware pipeline against the local Postgres. Only the identity provider and push are faked. */
export async function bootTestApp(opts: { port?: number; logger?: ('log' | 'error' | 'warn')[] } = {}): Promise<TestApp> {
  // The REAL SupabaseService runs (token cache, in-flight de-dup, user cache); only its network client is replaced.
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(FIREBASE_ADMIN_MESSAGING)
    .useValue({ sendEachForMulticast: async () => ({ responses: [], successCount: 0, failureCount: 0 }) } as unknown as Messaging)
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false, logger: opts.logger ?? ['error'] });
  configureApp(app);
  await app.init();
  (app.get(SupabaseService) as unknown as { client: unknown }).client = {
    auth: {
      admin: { deleteUser: async () => ({ error: null }) },
      getUser: async (token: string) => {
        try {
          const sub = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).sub;
          return sub ? { data: { user: { id: sub, email: null, user_metadata: {} } }, error: null } : { data: { user: null }, error: { status: 401, message: 'invalid' } };
        } catch {
          return { data: { user: null }, error: { status: 401, message: 'invalid' } };
        }
      },
    },
  };
  await app.listen(opts.port ?? 0, '127.0.0.1');
  const url = await app.getUrl();
  return { app, prisma: app.get(PrismaService), url, close: () => app.close() };
}
