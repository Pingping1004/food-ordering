/**
 * Tiny in-process TTL cache with in-flight de-duplication: concurrent callers for one key share a single
 * loader call. Bounded (oldest entry evicted first) so a long-lived process cannot grow without limit.
 * Per-process only: swap for a shared store (Redis) if the API ever runs on more than one instance and
 * cross-instance consistency matters.
 */
export class TtlCache<T> {
  private readonly entries = new Map<string, { value: T; expiresAt: number }>();
  private readonly inflight = new Map<string, Promise<T>>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 500,
  ) {}

  async get(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.entries.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.value;

    const pending = this.inflight.get(key);
    if (pending) return pending;

    const p = load()
      .then((value) => {
        this.entries.delete(key);
        this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
        if (this.entries.size > this.maxEntries) {
          const oldest = this.entries.keys().next().value;
          if (oldest !== undefined) this.entries.delete(oldest);
        }
        return value;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, p);
    return p;
  }

  /** Drop every entry whose key starts with `prefix` (e.g. `schoolId:`). */
  invalidate(prefix: string) {
    for (const k of this.entries.keys()) if (k.startsWith(prefix)) this.entries.delete(k);
  }
}
