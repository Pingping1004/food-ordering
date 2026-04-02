import { handleTokenRefresh } from "./api";

const INACTIVITY_LIMIT_MS = 7 * 24 * 60 * 60 * 1000; // 8 hours inactive → logout
const REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1000; // refresh when <5 min left
const LAST_ACTIVE_KEY = 'last_active_at';


let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
let tokenRefreshTimer: ReturnType<typeof setTimeout> | null = null;
let onLogoutCallback: (() => void) | null = null;

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];

export function startInactivityWatcher({
  onLogout,
  tokenExpiresInSeconds = 1800, // 30 min
}: {
  onLogout: () => void;
  tokenExpiresInSeconds?: number;
}) {
  onLogoutCallback = onLogout;

  ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, handleActivity, { passive: true }));

  const lastActive = localStorage.getItem(LAST_ACTIVE_KEY);
  if (lastActive) {
    const elapsed = Date.now() - parseInt(lastActive);
    if (elapsed > INACTIVITY_LIMIT_MS) {
        onLogout();
        return;
    }
  }

  // Also refresh when user returns to tab
  document.addEventListener('visibilitychange', handleVisibilityChange);

  resetInactivityTimer();
  scheduleTokenRefresh(tokenExpiresInSeconds);
}

export function stopInactivityWatcher() {
  ACTIVITY_EVENTS.forEach((event) =>
    window.removeEventListener(event, handleActivity)
  );
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  clearAllTimers();
}

function handleActivity() {
    localStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());
  resetInactivityTimer();
}

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    // User returned to tab — check if session is still valid
    // The next API call will trigger refresh if needed
    resetInactivityTimer();
  }
}

function resetInactivityTimer() {
  if (inactivityTimer) clearTimeout(inactivityTimer);

  inactivityTimer = setTimeout(() => {
    onLogoutCallback?.();
  }, INACTIVITY_LIMIT_MS);
}

function scheduleTokenRefresh(expiresInSeconds: number) {
  if (tokenRefreshTimer) clearTimeout(tokenRefreshTimer);

  const refreshInMs = (expiresInSeconds * 1000) - REFRESH_BEFORE_EXPIRY_MS;
  if (refreshInMs <= 0) return;

  tokenRefreshTimer = setTimeout(async () => {
    try {
      await handleTokenRefresh();
      scheduleTokenRefresh(1800);
    } catch {
      onLogoutCallback?.();
    }
  }, refreshInMs);
}

function clearAllTimers() {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  if (tokenRefreshTimer) clearTimeout(tokenRefreshTimer);
}