// Sentry's browser SDK is ~120 kB of JS. Loading it after the page is interactive keeps it off the critical path;
// the trade-off is that errors thrown in the first moments of a page load may not be reported.
type SentryModule = typeof import("@sentry/nextjs");

let sentry: Promise<SentryModule> | undefined;

function loadSentry() {
    sentry ??= import("@sentry/nextjs").then((m) => {
        m.init({
            dsn: "https://877246a9c8fec69f4163f29c9d4fd538@o4509643108843520.ingest.us.sentry.io/4509643109040128",
            // 100% sampling made every page load a billable trace and added main-thread work; 10% matches the server config.
            tracesSampleRate: 0.1,
            debug: false,
        });
        return m;
    });
    return sentry;
}

if (typeof window !== "undefined") {
    const start = () => void loadSentry();
    if (document.readyState === "complete") setTimeout(start, 2000);
    else window.addEventListener("load", () => setTimeout(start, 2000), { once: true });
}

export const onRouterTransitionStart = (...args: Parameters<SentryModule["captureRouterTransitionStart"]>) => {
    void loadSentry().then((m) => m.captureRouterTransitionStart(...args));
};
