/** localStorage: the visitor's light/dark choice from the navbar toggle. */
export const THEME_KEY = 'ps-theme'
/** sessionStorage: the cinematic intro has played in this browser session. */
export const INTRO_SEEN_KEY = 'ps-intro'

/**
 * Inline in <head>, before first paint, on the landing page only:
 * - a stored light/dark choice goes on <html data-lp-theme> (otherwise the system decides), so there is no theme flash;
 * - the intro either is marked as already seen this session (or reduced motion), or locks scrolling while it plays.
 */
export const LANDING_BOOT_SCRIPT = `try{if(location.pathname==="/"){var d=document.documentElement,t=localStorage.getItem("${THEME_KEY}");if(t==="dark"||t==="light")d.dataset.lpTheme=t;if(sessionStorage.getItem("${INTRO_SEEN_KEY}")==="1"||matchMedia("(prefers-reduced-motion: reduce)").matches)d.classList.add("lp-intro-seen");else d.classList.add("lp-intro-lock")}}catch(e){}`
