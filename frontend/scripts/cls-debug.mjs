// Logs each layout shift (time, value, element, before/after rect) for a logged-in page.  node scripts/cls-debug.mjs <role> <path>
import { chromium, devices } from "@playwright/test";
import fs from "node:fs";
const env = {};
for (const l of fs.readFileSync(".env.lh", "utf8").split("\n")) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim(); }
const [role, path] = process.argv.slice(2), R = role.toUpperCase();
const ctx = await chromium.launch({ channel: "chrome" }).then((b) => b.newContext({ ...devices["Pixel 5"] }));
const page = await ctx.newPage();
if (process.env.BLOCK_FONTS) await ctx.route(/\.woff2?$/, (r) => r.abort());
await page.goto(`${env.LH_BASE}/login`);
await page.locator('input[type="email"]').fill(env[`LH_${R}_EMAIL`]);
await page.locator('input[type="password"]').fill(env[`LH_${R}_PASSWORD`]);
await page.locator('button[type="submit"]').click();
await page.waitForURL((u) => !u.pathname.startsWith("/login"));
await page.addInitScript(() => {
    window.__shifts = [];
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__shifts.push({ t: Math.round(e.startTime), v: +e.value.toFixed(3), src: e.sources.map((s) => ({ el: s.node?.nodeName + "." + (s.node?.className?.toString().slice(0, 60) ?? ""), from: [s.previousRect.y, s.previousRect.height].map(Math.round), to: [s.currentRect.y, s.currentRect.height].map(Math.round) })) }); }).observe({ type: "layout-shift", buffered: true });
});
await page.goto(`${env.LH_BASE}${path.replace('/R', '/' + env.LH_RESTAURANT_ID).replace('/S', '/' + env.LH_SCHOOL_ID)}`);
for (const ms of [500, 900, 1200, 1600, 3000]) { await page.waitForTimeout(ms === 500 ? 500 : 300); await page.screenshot({ path: `${process.env.TMPDIR}/shot-${ms}.png` }); }
await page.waitForTimeout(2000);
console.log(JSON.stringify(await page.evaluate(() => window.__shifts), null, 1));
process.exit(0);
