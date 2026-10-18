// Authenticated Lighthouse run against a production server.
//   NEXT_DIST_DIR=.next-lh npx next build && NEXT_DIST_DIR=.next-lh npx next start -p 3200
//   node scripts/lighthouse.mjs /login                                   (public page, no login)
//   LH_EMAIL=… LH_PASSWORD=… node scripts/lighthouse.mjs /school/<id>     (gated page)
import { chromium } from "@playwright/test";
import lighthouse from "lighthouse";
import fs from "node:fs";

const base = process.env.LH_BASE ?? "http://localhost:3200";
const path = process.argv[2] ?? "/login";
const runs = Number(process.env.LH_RUNS ?? 1);
const port = 9333;

const browser = await chromium.launch({ channel: "chrome", args: [`--remote-debugging-port=${port}`] });
const page = await browser.newPage();

if (process.env.LH_EMAIL) {
    await page.goto(`${base}/login`);
    await page.locator('input[type="email"]').fill(process.env.LH_EMAIL);
    await page.locator('input[type="password"]').fill(process.env.LH_PASSWORD ?? "");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
}

fs.mkdirSync("lh-reports", { recursive: true });
for (let i = 0; i < runs; i++) {
    // Lighthouse default mobile emulation + simulated throttling, reusing the logged-in browser profile.
    const { lhr } = await lighthouse(`${base}${path}`, { port, output: "json", onlyCategories: ["performance"], disableStorageReset: true });
    const a = lhr.audits, v = (k) => a[k]?.displayValue;
    console.log(`run ${i + 1}: score=${Math.round(lhr.categories.performance.score * 100)} FCP=${v("first-contentful-paint")} LCP=${v("largest-contentful-paint")} TBT=${v("total-blocking-time")} CLS=${v("cumulative-layout-shift")} final=${lhr.finalDisplayedUrl}`);
    fs.writeFileSync(`lh-reports/${path.replace(/\W+/g, "_")}-${i + 1}.json`, JSON.stringify(lhr));
}
await page.close();
await browser.close();
