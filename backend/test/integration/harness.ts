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

export const tokenFor = (userId: string) => `test-token:${userId}`;
export const authHeader = (userId: string) => ({ Authorization: `Bearer ${tokenFor(userId)}` });

export interface TestApp {
  app: NestExpressApplication;
  prisma: PrismaService;
  /** Base URL of the one real listening server; use `request(t.url)` so concurrent requests share it. */
  url: string;
  close: () => Promise<void>;
}

/** Boots the real AppModule + the real production middleware pipeline against the local Postgres. Only the identity provider and push are faked. */
export async function bootTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(SupabaseService)
    .useFactory({
      inject: [PrismaService],
      factory: (prisma: PrismaService) => ({
        // Token format `test-token:<userId>`; unknown users are rejected like an invalid Supabase token.
        verifyAccessToken: async (token: string) => {
          const id = token.startsWith('test-token:') ? token.slice('test-token:'.length) : null;
          if (!id) return null;
          const aal = id.startsWith('aal2-') ? 'aal2' : 'aal1';
          return { id, email: null, name: null, aal };
        },
        resolveUser: async (identity: { id: string }) => {
          const u = await prisma.user.findUnique({
            where: { userId: identity.id },
            select: { userId: true, email: true, role: true },
          });
          if (!u) throw new Error(`test user ${identity.id} missing`);
          return u;
        },
      }),
    })
    .overrideProvider(FIREBASE_ADMIN_MESSAGING)
    .useValue({ sendEachForMulticast: async () => ({ responses: [], successCount: 0, failureCount: 0 }) } as unknown as Messaging)
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false, logger: ['error'] });
  configureApp(app);
  await app.listen(0, '127.0.0.1');
  const url = await app.getUrl();
  return { app, prisma: app.get(PrismaService), url, close: () => app.close() };
}
