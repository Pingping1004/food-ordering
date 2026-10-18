import { defineConfig, devices } from '@playwright/test';

const WEB = Number(process.env.E2E_PORT || 3100);
const API_PORT = 4010;
const SUPABASE_PORT = 54321;
const DB = process.env.E2E_DB || 'promptserve_e2e';
const dbUrl = `postgresql://${process.env.PGUSER || 'postgres'}${process.env.PGPASSWORD ? ':' + process.env.PGPASSWORD : ''}@${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || 55432}/${DB}`;

/**
 * Browser tests run the REAL Next.js app and the REAL NestJS API (real Postgres, production middleware and guards).
 * Only the identity provider is replaced: tests/e2e/support/fake-supabase.mjs stands in for Supabase Auth, and
 * the API accepts its tokens through the same fake client the integration tests use.
 *
 *   tests/e2e/prepare.sh && npx playwright test
 *
 * Next runs from its own dist dir (.next-e2e) so it never touches a `next dev` you already have open.
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL || `http://localhost:${WEB}`,
    viewport: { width: 1280, height: 800 },
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node tests/e2e/support/fake-supabase.mjs',
      url: `http://127.0.0.1:${SUPABASE_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      env: { FAKE_SUPABASE_PORT: String(SUPABASE_PORT) },
    },
    {
      command: 'npm --prefix ../backend run load:server',
      url: `http://127.0.0.1:${API_PORT}/api/ready`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { NODE_ENV: 'test', PORT: String(API_PORT), DATABASE_URL: dbUrl, DIRECT_URL: dbUrl, CORS_EXTRA_ORIGINS: `http://localhost:${WEB}` },
    },
    {
      command: `npx next dev -p ${WEB}`,
      url: `http://localhost:${WEB}/login`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        NEXT_DIST_DIR: '.next-e2e',
        NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${SUPABASE_PORT}`,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
        NEXT_PUBLIC_BACKEND_API_URL: `http://127.0.0.1:${API_PORT}`,
        NEXT_PUBLIC_API_URL: `http://127.0.0.1:${API_PORT}`,
      },
    },
  ],
});
