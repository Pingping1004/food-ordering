// Lighthouse (mobile, performance) over every school / cooker / user route, logged in per role.
//   node scripts/lh-all.mjs [school|cooker|user ...]      credentials + IDs come from .env.lh (see .env.lh.example)
import { chromium } from "@playwright/test";
import lighthouse from "lighthouse";
import fs from "node:fs";
import os from "node:os";
import path_ from "node:path";

const env = { ...process.env };
if (fs.existsSync(".env.lh")) {
    for (const line of fs.readFileSync(".env.lh", "utf8").split("\n")) {
        const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
        if (m && !line.trim().startsWith("#") && m[2]) env[m[1]] ??= m[2];
    }
}
const base = env.LH_BASE ?? "http://localhost:3200";
const TARGET = Number(env.LH_TARGET ?? 85);
const RUNS = Number(env.LH_RUNS ?? 3);
const id = { U: env.LH_USER_ID, S: env.LH_SCHOOL_ID, R: env.LH_RESTAURANT_ID, M: env.LH_MENU_ID, O: env.LH_ORDER_ID };

const ROUTES = {
    public: ["/", "/login", "/signup", "/forgot-password", "/reset-password"],
    admin: ["/admin/mfa", "/admin/payout", "/admin/schools", "/admin/schools/S"],
    school: ["/school/S", "/school/S/approvals", "/school/S/audit", "/school/S/canteens/new", "/school/S/feedback", "/school/S/refunds",
        "/school/S/reliability", "/school/S/report", "/school/S/restaurants", "/school/S/restaurants/R", "/school/S/settings", "/school/S/staff"],
    cooker: ["/cooker/R", "/cooker/hours/R", "/cooker/pending/R", "/cooker/profile/R", "/cooker/refunds/R", "/cooker/restaurant/add-menu-bulk/R",
        "/cooker/restaurant/add-menu/R", "/cooker/restaurant/edit-menu/M", "/cooker/restaurant/managed-menu/R", "/cooker/staff/R", "/cooker/summary/R", "/cooker/restaurant-register/U"],
    user: ["/user/account", "/user/closed", "/user/onboarding/notify", "/user/onboarding/school", "/user/orders", "/user/refunds", "/user/restaurant",
        "/user/restaurant/R", "/user/order/confirm/R", "/user/order/done/O", "/user/order/failed/O", "/user/order/payment/O", "/user/order/refund/O",
        "/user/order/slip-failed/O", "/user/order/wait/O", "/onboarding", "/onboarding/pending", "/workspace"],
};

const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const roles = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(ROUTES);
const rows = [];
let port = 9340;

for (const role of roles) {
    const email = env[`LH_${role.toUpperCase()}_EMAIL`], password = env[`LH_${role.toUpperCase()}_PASSWORD`];
    if (!email && role !== "public") { console.log(`skip ${role}: no credentials`); continue; }
    // Persistent context = Chrome's default profile, so Lighthouse's own tab sees the login cookies (a plain newPage() would not).
    const profile = fs.mkdtempSync(path_.join(os.tmpdir(), "lh-profile-"));
    const browser = await chromium.launchPersistentContext(profile, { channel: "chrome", args: [`--remote-debugging-port=${++port}`] });
    const page = browser.pages()[0] ?? await browser.newPage();
    if (role !== "public") {
        await page.goto(`${base}/login`);
        await page.locator('input[type="email"]').fill(email);
        await page.locator('input[type="password"]').fill(password ?? "");
        await page.locator('button[type="submit"]').click();
        try { await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 }); }
        catch { console.log(`FAIL ${role}: login did not complete`); await browser.close(); continue; }
    }

    for (const tpl of ROUTES[role]) {
        if (env.LH_ONLY && !env.LH_ONLY.split(",").some((f) => tpl.includes(f))) continue;
        const path = tpl.replace(/\/([SRMOU])(?=\/|$)/g, (_, k) => `/${id[k] ?? "\0"}`);
        if (path.includes("\0")) { console.log(`skip ${tpl}: missing ID`); continue; }
        const scores = []; let last, final;
        for (let i = 0; i < RUNS; i++) {
            const { lhr } = await lighthouse(`${base}${path}`, { port, output: "json", onlyCategories: ["performance"], disableStorageReset: true });
            scores.push(Math.round(lhr.categories.performance.score * 100)); last = lhr; final = lhr.finalDisplayedUrl;
            fs.mkdirSync("lh-reports", { recursive: true });
            fs.writeFileSync(`lh-reports/${role}-${tpl.replace(/\W+/g, "_")}.json`, JSON.stringify(lhr));
        }
        const a = last.audits, v = (k) => a[k]?.displayValue ?? "-";
        const redirected = new URL(final).pathname !== path ? ` -> ${new URL(final).pathname}` : "";
        rows.push({ role, route: tpl, score: median(scores), LCP: v("largest-contentful-paint"), TBT: v("total-blocking-time"), CLS: v("cumulative-layout-shift"), note: redirected });
        console.log(`${median(scores) >= TARGET ? "ok  " : "LOW "} ${String(median(scores)).padStart(3)}  ${role} ${tpl}  LCP=${v("largest-contentful-paint")} TBT=${v("total-blocking-time")} CLS=${v("cumulative-layout-shift")}${redirected}`);
    }
    await browser.close();
    fs.rmSync(profile, { recursive: true, force: true });
}
const low = rows.filter((r) => r.score < TARGET);
console.log(`\n${rows.length} pages, ${low.length} below ${TARGET}`);
process.exit(low.length ? 1 : 0);
