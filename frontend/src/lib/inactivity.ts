const INACTIVITY_LIMIT_MS = 7 * 24 * 60 * 60 * 1000;
const LAST_ACTIVE_KEY = 'last_active_at';


let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
let onLogoutCallback: (() => void) | null = null;

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];

export function startInactivityWatcher({
  onLogout,
  freshLogin = false
}: {
  onLogout: () => void;
  freshLogin?: boolean;
}) {
  onLogoutCallback = onLogout;

  ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, handleActivity, { passive: true }));

  if (!freshLogin) {
    const lastActive = localStorage.getItem(LAST_ACTIVE_KEY);
    if (lastActive) {
      const elapsed = Date.now() - parseInt(lastActive);
      if (elapsed > INACTIVITY_LIMIT_MS) {
          onLogout();
          return;
      }
    }
  }

  localStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());

  document.addEventListener('visibilitychange', handleVisibilityChange);
  resetInactivityTimer();
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
    const lastActive = localStorage.getItem(LAST_ACTIVE_KEY);

    if (lastActive) {
      const elapsed = Date.now() - parseInt(lastActive);
      if (elapsed > INACTIVITY_LIMIT_MS) {
        onLogoutCallback?.();
        return;
      }
    }

    resetInactivityTimer();
  }
}

function resetInactivityTimer() {
  if (inactivityTimer) clearTimeout(inactivityTimer);

  inactivityTimer = setTimeout(() => {
    onLogoutCallback?.();
  }, INACTIVITY_LIMIT_MS);
}

function clearAllTimers() {
  if (inactivityTimer) clearTimeout(inactivityTimer);
}