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
});
