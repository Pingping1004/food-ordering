/**
 * "Install Promptserve on your phone" support: which phone/browser this is, whether the app is already installed,
 * and Android Chrome's one-tap install prompt.
 */

/**
 * Chrome fires `beforeinstallprompt` once, often before React has hydrated. This inline script (root layout) keeps
 * the event so the banner can offer a one-tap "install" button later.
 */
export const INSTALL_PROMPT_BOOT_SCRIPT = `window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__installPrompt=e;window.dispatchEvent(new Event('installprompt-ready'))});window.addEventListener('appinstalled',function(){window.__installPrompt=null});`;

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type InstallWindow = Window & { __installPrompt?: InstallPromptEvent | null };

/**
 * - ios / android: the phone's normal browser (Safari, Chrome, Samsung Internet...)
 * - in-app: a browser inside LINE / Facebook / Instagram / TikTok, which cannot install apps
 * - desktop: no banner
 */
export type InstallPlatform = "ios" | "android" | "desktop";
export type InstallEnv = { platform: InstallPlatform; inApp: "line" | "other" | null; iosBrowser: "safari" | "other"; samsung: boolean };

export function detectInstallEnv(ua = navigator.userAgent, touchPoints = navigator.maxTouchPoints ?? 0): InstallEnv {
    // iPadOS reports itself as a Mac; a touch screen gives it away.
    const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1);
    const android = /Android/.test(ua);
    const inApp = /\bLine\//i.test(ua) ? "line" : /FBAN|FBAV|FB_IAB|Instagram|musical_ly|BytedanceWebview|TikTok/i.test(ua) ? "other" : null;
    return {
        platform: ios ? "ios" : android ? "android" : "desktop",
        inApp,
        iosBrowser: ios && /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua) ? "other" : "safari",
        samsung: /SamsungBrowser/.test(ua),
    };
}

/** Opened from the home-screen icon (already installed). */
export function isRunningInstalled(): boolean {
    if (typeof window === "undefined") return false;
    return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export const hasInstallPrompt = () => typeof window !== "undefined" && !!(window as InstallWindow).__installPrompt;

/** Shows Chrome's own "Install app?" dialog. Resolves true when the user accepted. */
export async function promptInstall(): Promise<boolean> {
    const w = window as InstallWindow;
    const e = w.__installPrompt;
    if (!e) return false;
    w.__installPrompt = null; // the event can be used only once
    await e.prompt();
    return (await e.userChoice).outcome === "accepted";
}

/** LINE's in-app browser opens a link in the phone's normal browser when it carries `openExternalBrowser=1`. */
export function externalBrowserUrl(href = window.location.href): string {
    const url = new URL(href);
    url.searchParams.set("openExternalBrowser", "1");
    return url.toString();
}
