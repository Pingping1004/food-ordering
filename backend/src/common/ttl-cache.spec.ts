import { TtlCache } from './ttl-cache';

describe('TtlCache', () => {
  afterEach(() => jest.useRealTimers());

  it('shares one loader call between concurrent callers', async () => {
    const cache = new TtlCache<number>(1000);
    const load = jest.fn().mockResolvedValue(7);
    const [a, b] = await Promise.all([cache.get('k', load), cache.get('k', load)]);
    expect([a, b]).toEqual([7, 7]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('serves from cache until the TTL passes, then reloads', async () => {
    jest.useFakeTimers();
    const cache = new TtlCache<number>(1000);
    const load = jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    expect(await cache.get('k', load)).toBe(1);
    expect(await cache.get('k', load)).toBe(1);
    jest.advanceTimersByTime(1001);
    expect(await cache.get('k', load)).toBe(2);
  });

  it('does not cache failures', async () => {
    const cache = new TtlCache<number>(1000);
    const load = jest.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(3);
    await expect(cache.get('k', load)).rejects.toThrow('boom');
    expect(await cache.get('k', load)).toBe(3);
  });

  it('evicts the oldest entry past maxEntries and supports prefix invalidation', async () => {
    const cache = new TtlCache<number>(1000, 2);
    const load = jest.fn().mockImplementation(async () => 1);
    await cache.get('a:1', load);
    await cache.get('a:2', load);
    await cache.get('b:1', load);
    expect(load).toHaveBeenCalledTimes(3);
    await cache.get('a:1', load); // evicted -> reload
    expect(load).toHaveBeenCalledTimes(4);
    cache.invalidate('b:');
    await cache.get('b:1', load);
    expect(load).toHaveBeenCalledTimes(5);
  });

  it('never stores a load that started before an invalidation (no stale write-back)', async () => {
    const cache = new TtlCache<string>(60_000);
    let release!: (v: string) => void;
    const slow = cache.get('shop', () => new Promise<string>((r) => (release = r)));
    cache.invalidate('shop'); // e.g. the shop was suspended while the old status was being read
    release('ACTIVE');
    expect(await slow).toBe('ACTIVE'); // the caller already in flight gets its answer...
    expect(await cache.get('shop', async () => 'SUSPENDED')).toBe('SUSPENDED'); // ...but it was not cached
  });

  it('skips caching values rejected by cacheIf (e.g. not found)', async () => {
    const cache = new TtlCache<string | null>(60_000);
    const load = jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce('created');
    expect(await cache.get('k', load, (v) => v !== null)).toBeNull();
    expect(await cache.get('k', load, (v) => v !== null)).toBe('created');
    expect(load).toHaveBeenCalledTimes(2);
  });
});
