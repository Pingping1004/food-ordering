/**
 * Bounded fixed-window counter keyed by an arbitrary string (a user id). In-process, like TtlCache: with more
 * than one API instance each instance enforces its own window, so the effective limit is `limit × instances`.
 */
export class FixedWindowLimiter {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly maxKeys = 20_000,
  ) {}

  /** Counts one hit. `retryAfterSec` is only meaningful when `allowed` is false. */
  hit(key: string, now = Date.now()): { allowed: boolean; retryAfterSec: number } {
    let w = this.windows.get(key);
    if (!w || w.resetAt <= now) {
      if (this.windows.size >= this.maxKeys) this.sweep(now);
      w = { count: 0, resetAt: now + this.windowMs };
      this.windows.set(key, w);
    }
    w.count += 1;
    return {
      allowed: w.count <= this.limit,
      retryAfterSec: Math.max(1, Math.ceil((w.resetAt - now) / 1000)),
    };
  }

  private sweep(now: number) {
    for (const [k, w] of this.windows) if (w.resetAt <= now) this.windows.delete(k);
    // Still full of live windows: drop the oldest so memory stays bounded under a key-flood.
    while (this.windows.size >= this.maxKeys) {
      const oldest = this.windows.keys().next().value;
      if (oldest === undefined) break;
      this.windows.delete(oldest);
    }
  }
}
